import { query, tx } from '../db/pool.js';
import { adapterFor } from '../adapters/index.js';
import { generateWarmupMessage, generateReply } from './warmup-content.js';
import { logger } from '../lib/logger.js';

/**
 * Returns inboxes in the warmup pool that haven't hit today's cap yet.
 * Excludes SMTP relays and disabled/errored inboxes.
 */
export async function eligibleSenders() {
  const { rows } = await query(`
    SELECT i.*, COALESCE(today.sent, 0) AS sent_today
    FROM inboxes i
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS sent
      FROM warmup_threads w
      WHERE w.sender_inbox_id = i.id
        AND w.sent_at >= date_trunc('day', now())
    ) today ON TRUE
    WHERE i.warmup_enabled = TRUE
      AND i.status = 'active'
      AND i.provider IN ('gmail','microsoft','imap')
      AND COALESCE(today.sent, 0) < i.warmup_current_cap
  `);
  return rows;
}

/**
 * Pick a receiver from the pool that is NOT the sender and belongs to a
 * different user (to maximise reputation benefit). Falls back to same-user
 * if cross-user partners aren't available.
 */
export async function pickReceiver(sender) {
  const cross = await query(`
    SELECT * FROM inboxes
    WHERE warmup_enabled = TRUE AND status = 'active'
      AND id <> $1 AND user_id <> $2
      AND provider IN ('gmail','microsoft','imap')
    ORDER BY random() LIMIT 1
  `, [sender.id, sender.user_id]);
  if (cross.rows[0]) return cross.rows[0];

  const same = await query(`
    SELECT * FROM inboxes
    WHERE warmup_enabled = TRUE AND status = 'active'
      AND id <> $1 AND user_id = $2
      AND provider IN ('gmail','microsoft','imap')
    ORDER BY random() LIMIT 1
  `, [sender.id, sender.user_id]);
  return same.rows[0] || null;
}

export async function runOneWarmupSend(sender) {
  const receiver = await pickReceiver(sender);
  if (!receiver) { logger.warn({ sender: sender.email }, 'no eligible receiver'); return null; }

  const senderAd = adapterFor(sender);
  const { subject, text, html } = generateWarmupMessage({
    fromName: sender.display_name, toName: receiver.display_name,
  });

  const sent = await senderAd.send({ to: receiver.email, subject, text, html, headers: { 'X-LR-Warmup': '1' } });
  await tx(async (c) => {
    await c.query(
      `INSERT INTO warmup_threads (sender_inbox_id, receiver_inbox_id, subject, provider_message_id, thread_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [sender.id, receiver.id, subject, sent.messageId, sent.threadId]
    );
    await c.query(
      `INSERT INTO email_events (user_id, inbox_id, kind, provider_message_id, thread_id, meta)
       VALUES ($1,$2,'warmup_sent',$3,$4,$5)`,
      [sender.user_id, sender.id, sent.messageId, sent.threadId, { to: receiver.email }]
    );
  });

  logger.info({ from: sender.email, to: receiver.email, subject }, 'warmup sent');
  return { senderId: sender.id, receiverId: receiver.id, messageId: sent.messageId };
}

/**
 * Run receiver-side engagement:
 *  - find recent X-LR-Warmup messages
 *  - mark important
 *  - if in spam, move to inbox (and record rescued=true)
 *  - reply in-thread (according to sender's warmup_reply_rate)
 */
export async function runReceiverEngagement(inbox) {
  const ad = adapterFor(inbox);

  // Check spam first
  let spamMessages = [];
  try { spamMessages = await ad.listRecent({ mailbox: 'SPAM', maxResults: 20 }); } catch {}
  try { spamMessages = spamMessages.concat(await ad.listRecent({ mailbox: 'Junk', maxResults: 20 })); } catch {}
  const recent = await ad.listRecent({ maxResults: 50 });

  const candidates = [...spamMessages, ...recent];
  const warmupRefs = new Map();

  for (const msg of candidates) {
    // Correlate by thread_id / message_id against warmup_threads with this receiver
    const { rows } = await query(
      `SELECT * FROM warmup_threads
       WHERE receiver_inbox_id = $1
         AND (thread_id = $2 OR provider_message_id = $2 OR subject = $3)
         AND sent_at > now() - interval '2 days'
         AND replied_at IS NULL
       LIMIT 1`,
      [inbox.id, msg.threadId || msg.id, msg.subject]
    );
    if (!rows[0]) continue;
    warmupRefs.set(msg.id, { msg, thread: rows[0] });
  }

  for (const { msg, thread } of warmupRefs.values()) {
    const wasInSpam = spamMessages.find(s => s.id === msg.id);
    if (wasInSpam) {
      try {
        await ad.moveFromSpamToInbox(msg.id);
        await query(`UPDATE warmup_threads SET landed_in='spam', rescued=TRUE WHERE id=$1`, [thread.id]);
        await query(
          `INSERT INTO email_events (user_id, inbox_id, kind, thread_id, meta)
           VALUES ($1,$2,'warmup_rescued_from_spam',$3,$4)`,
          [inbox.user_id, inbox.id, msg.threadId, { subject: msg.subject }]
        );
        logger.info({ inbox: inbox.email, subject: msg.subject }, 'rescued warmup from spam');
      } catch (e) { logger.warn({ err: e.message }, 'rescue failed'); }
    } else {
      await query(`UPDATE warmup_threads SET landed_in='inbox' WHERE id=$1 AND landed_in IS NULL`, [thread.id]);
    }

    try { await ad.markImportant(msg.id); } catch {}

    // Reply probabilistically. Use sender's configured reply rate.
    const { rows: s } = await query(`SELECT warmup_reply_rate FROM inboxes WHERE id=$1`, [thread.sender_inbox_id]);
    const rate = s[0]?.warmup_reply_rate ?? 0.4;
    if (Math.random() < rate) {
      const reply = generateReply({ fromName: inbox.display_name });
      try {
        await ad.reply({
          threadId: msg.threadId, messageId: msg.id,
          to: (await senderEmailFor(thread.sender_inbox_id)),
          subject: msg.subject, text: reply.text, html: reply.html,
          inReplyTo: thread.provider_message_id,
        });
        await query(`UPDATE warmup_threads SET replied_at = now() WHERE id=$1`, [thread.id]);
        await query(
          `INSERT INTO email_events (user_id, inbox_id, kind, thread_id, meta)
           VALUES ($1,$2,'warmup_replied',$3,$4)`,
          [inbox.user_id, inbox.id, msg.threadId, {}]
        );
      } catch (e) { logger.warn({ err: e.message }, 'warmup reply failed'); }
    }
  }
}

async function senderEmailFor(inboxId) {
  const { rows } = await query(`SELECT email FROM inboxes WHERE id = $1`, [inboxId]);
  return rows[0]?.email;
}

/**
 * Daily ramp-up job: advance each enabled inbox's warmup_current_cap
 * toward warmup_daily_max by warmup_ramp_step, but only if yesterday
 * performance was healthy (<20% spam, >=80% reply success).
 */
export async function rampUpCaps() {
  const { rows } = await query(`SELECT * FROM inboxes WHERE warmup_enabled = TRUE`);
  for (const inb of rows) {
    const { rows: stats } = await query(`
      SELECT
        COUNT(*)::INT AS total,
        SUM(CASE WHEN landed_in = 'spam' THEN 1 ELSE 0 END)::INT AS spam,
        SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END)::INT AS replied
      FROM warmup_threads
      WHERE sender_inbox_id = $1
        AND sent_at > now() - interval '1 day'
    `, [inb.id]);
    const s = stats[0] || { total: 0, spam: 0, replied: 0 };
    const spamRate = s.total ? s.spam / s.total : 0;
    const replyRate = s.total ? s.replied / s.total : 1;
    const healthy = spamRate < 0.2 && replyRate >= 0.6;

    let newCap = inb.warmup_current_cap;
    if (healthy && inb.warmup_current_cap < inb.warmup_daily_max) {
      newCap = Math.min(inb.warmup_current_cap + inb.warmup_ramp_step, inb.warmup_daily_max);
    } else if (!healthy && inb.warmup_current_cap > inb.warmup_daily_min) {
      newCap = Math.max(inb.warmup_current_cap - inb.warmup_ramp_step, inb.warmup_daily_min);
    }

    const reputation = Math.max(0, Math.min(100,
      Math.round(100 - (spamRate * 70) + ((replyRate - 0.5) * 40))
    ));

    await query(
      `UPDATE inboxes SET warmup_current_cap=$1, reputation_score=$2, updated_at=now() WHERE id=$3`,
      [newCap, reputation, inb.id]
    );
  }
}
