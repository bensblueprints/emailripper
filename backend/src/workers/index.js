import 'dotenv/config';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../lib/logger.js';
import { query } from '../db/pool.js';
import { eligibleSenders, runOneWarmupSend, runReceiverEngagement, rampUpCaps } from '../services/warmup.js';
import { runCampaignStep } from '../services/campaign-sender.js';

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

export const warmupSendQ = new Queue('warmup-send', { connection });
export const warmupEngageQ = new Queue('warmup-engage', { connection });
export const campaignQ = new Queue('campaign-send', { connection });

// Scheduler: every 5 minutes, enqueue one warmup send job per eligible inbox
// that is under its per-slot budget. Sends are spread through the day.
async function scheduleTick() {
  const senders = await eligibleSenders();
  for (const s of senders) {
    // budget per 5-min slot: cap/NUM_SLOTS where NUM_SLOTS ~= 60 (5-hour window).
    const slotsPerDay = 60;
    const perSlot = Math.max(1, Math.ceil(s.warmup_current_cap / slotsPerDay));
    for (let i = 0; i < perSlot; i++) {
      if ((s.sent_today + i) >= s.warmup_current_cap) break;
      // Jitter 0-300s to avoid bursts
      const delay = Math.floor(Math.random() * 300_000);
      await warmupSendQ.add('send', { inboxId: s.id }, { delay, removeOnComplete: 1000, removeOnFail: 1000 });
    }
  }

  // Engagement tick: for every warmup-enabled inbox, schedule an engagement pass
  const { rows } = await query(`SELECT id FROM inboxes WHERE warmup_enabled = TRUE AND status = 'active'`);
  for (const r of rows) {
    await warmupEngageQ.add('engage', { inboxId: r.id }, { delay: Math.floor(Math.random() * 120_000), removeOnComplete: 500 });
  }

  // Enqueue due campaign steps
  const { rows: due } = await query(`
    SELECT cl.id AS campaign_lead_id
    FROM campaign_leads cl
    JOIN campaigns c ON c.id = cl.campaign_id
    WHERE c.status = 'active'
      AND cl.status IN ('pending','in_progress')
      AND cl.next_send_at IS NOT NULL
      AND cl.next_send_at <= now()
    LIMIT 500
  `);
  for (const d of due) {
    await campaignQ.add('step', { campaignLeadId: d.campaign_lead_id }, { removeOnComplete: 500 });
  }
}

new Worker('warmup-send', async (job) => {
  const { rows } = await query(`SELECT * FROM inboxes WHERE id = $1`, [job.data.inboxId]);
  const inbox = rows[0];
  if (!inbox) return;
  await runOneWarmupSend(inbox);
}, { connection, concurrency: 8 });

new Worker('warmup-engage', async (job) => {
  const { rows } = await query(`SELECT * FROM inboxes WHERE id = $1`, [job.data.inboxId]);
  const inbox = rows[0];
  if (!inbox) return;
  await runReceiverEngagement(inbox);
}, { connection, concurrency: 8 });

new Worker('campaign-send', async (job) => {
  await runCampaignStep(job.data.campaignLeadId);
}, { connection, concurrency: 16 });

// Boot: kick scheduler every 5 min, ramp caps every 24h
setInterval(() => { scheduleTick().catch(e => logger.error({ err: e }, 'scheduler')); }, 5 * 60_000);
setInterval(() => { rampUpCaps().catch(e => logger.error({ err: e }, 'ramp')); }, 24 * 60 * 60_000);

// Run once at startup
scheduleTick().catch(e => logger.error({ err: e }, 'initial scheduler'));

logger.info('workers online: warmup-send, warmup-engage, campaign-send');
