import { query, tx } from '../db/pool.js';
import { adapterFor } from '../adapters/index.js';
import { logger } from '../lib/logger.js';

function render(tpl, lead) {
  if (!tpl) return '';
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.');
    let v = parts[0] === 'lead' ? lead : lead[parts[0]];
    for (const p of parts.slice(parts[0] === 'lead' ? 1 : 1)) v = v?.[p];
    return (v ?? '').toString();
  });
}

export async function runCampaignStep(campaignLeadId) {
  const { rows: cls } = await query(`
    SELECT cl.*, c.user_id, c.from_inbox_id, c.schedule, c.tracking, c.status AS c_status,
           l.email AS lead_email, l.first_name, l.last_name, l.company, l.job_title, l.custom
    FROM campaign_leads cl
    JOIN campaigns c ON c.id = cl.campaign_id
    JOIN leads l ON l.id = cl.lead_id
    WHERE cl.id = $1
  `, [campaignLeadId]);
  const cl = cls[0];
  if (!cl || cl.c_status !== 'active') return;

  const stepNumber = cl.current_step + 1;
  const { rows: steps } = await query(
    `SELECT * FROM sequence_steps WHERE campaign_id = $1 ORDER BY step_order ASC`,
    [cl.campaign_id]
  );
  const step = steps[stepNumber - 1];
  if (!step) {
    await query(`UPDATE campaign_leads SET status='completed' WHERE id=$1`, [cl.id]);
    return;
  }

  // Gate conditions
  if (step.condition !== 'always') {
    const { rows: evs } = await query(
      `SELECT kind FROM email_events WHERE campaign_id=$1 AND lead_id=$2`,
      [cl.campaign_id, cl.lead_id]
    );
    const kinds = new Set(evs.map(e => e.kind));
    if (step.condition === 'no_reply' && kinds.has('replied')) {
      await query(`UPDATE campaign_leads SET status='completed' WHERE id=$1`, [cl.id]);
      return;
    }
    if (step.condition === 'no_open' && kinds.has('opened')) {
      // Skip this step, move to next
      const next = steps[stepNumber];
      if (next) {
        const nextAt = new Date(Date.now() + next.delay_days * 24 * 3600_000);
        await query(
          `UPDATE campaign_leads SET current_step=$1, next_send_at=$2 WHERE id=$3`,
          [stepNumber, nextAt, cl.id]
        );
      } else {
        await query(`UPDATE campaign_leads SET status='completed' WHERE id=$1`, [cl.id]);
      }
      return;
    }
  }

  if (!cl.from_inbox_id) {
    logger.warn({ campaignLeadId }, 'campaign has no from_inbox_id; skipping');
    return;
  }

  const { rows: ibx } = await query(`SELECT * FROM inboxes WHERE id = $1`, [cl.from_inbox_id]);
  const inbox = ibx[0];
  if (!inbox || inbox.status !== 'active') return;

  // Respect daily send limit
  const { rows: todayCount } = await query(`
    SELECT COUNT(*)::INT AS n
    FROM email_events
    WHERE inbox_id = $1 AND kind = 'sent' AND created_at >= date_trunc('day', now())
  `, [inbox.id]);
  if ((todayCount[0]?.n || 0) >= inbox.daily_send_limit) {
    // defer to tomorrow 9am local
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); tomorrow.setUTCHours(9, 0, 0, 0);
    await query(`UPDATE campaign_leads SET next_send_at=$1 WHERE id=$2`, [tomorrow, cl.id]);
    return;
  }

  const lead = {
    email: cl.lead_email, first_name: cl.first_name, last_name: cl.last_name,
    company: cl.company, job_title: cl.job_title, ...cl.custom,
  };
  const subject = render(step.subject, lead);
  const html = render(step.body_html, lead);
  const text = render(step.body_text, lead);

  try {
    const ad = adapterFor(inbox);
    const sent = await ad.send({ to: lead.email, subject, html, text });
    await tx(async (c) => {
      await c.query(
        `INSERT INTO email_events (user_id, inbox_id, campaign_id, lead_id, kind, provider_message_id, thread_id)
         VALUES ($1,$2,$3,$4,'sent',$5,$6)`,
        [cl.user_id, inbox.id, cl.campaign_id, cl.lead_id, sent.messageId, sent.threadId]
      );

      const nextStep = steps[stepNumber];
      if (nextStep) {
        const nextAt = new Date(Date.now() + nextStep.delay_days * 24 * 3600_000);
        await c.query(
          `UPDATE campaign_leads SET status='in_progress', current_step=$1, next_send_at=$2, last_event_at=now() WHERE id=$3`,
          [stepNumber, nextAt, cl.id]
        );
      } else {
        await c.query(
          `UPDATE campaign_leads SET status='completed', current_step=$1, next_send_at=NULL, last_event_at=now() WHERE id=$2`,
          [stepNumber, cl.id]
        );
      }
    });
  } catch (err) {
    logger.error({ err, inbox: inbox.email, to: lead.email }, 'campaign send failed');
    await query(`UPDATE campaign_leads SET next_send_at = now() + interval '1 hour' WHERE id = $1`, [cl.id]);
  }
}
