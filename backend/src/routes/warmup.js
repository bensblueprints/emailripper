import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Per-inbox warmup dashboard — stats for the last 14 days.
router.get('/stats', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT i.id, i.email, i.provider, i.warmup_enabled, i.warmup_current_cap,
             i.warmup_daily_min, i.warmup_daily_max, i.reputation_score,
             (SELECT COUNT(*)::INT FROM warmup_threads w WHERE w.sender_inbox_id=i.id AND w.sent_at > now() - interval '14 days') AS sent_14d,
             (SELECT COUNT(*)::INT FROM warmup_threads w WHERE w.sender_inbox_id=i.id AND w.replied_at IS NOT NULL AND w.sent_at > now() - interval '14 days') AS replied_14d,
             (SELECT COUNT(*)::INT FROM warmup_threads w WHERE w.sender_inbox_id=i.id AND w.landed_in='spam' AND w.sent_at > now() - interval '14 days') AS spam_14d,
             (SELECT COUNT(*)::INT FROM warmup_threads w WHERE w.sender_inbox_id=i.id AND w.rescued=TRUE AND w.sent_at > now() - interval '14 days') AS rescued_14d,
             (SELECT COUNT(*)::INT FROM warmup_threads w WHERE w.sender_inbox_id=i.id AND w.sent_at >= date_trunc('day', now())) AS sent_today
      FROM inboxes i
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
    `, [req.user.id]);
    res.json({ inboxes: rows });
  } catch (err) { next(err); }
});

// Daily time series for a single inbox
router.get('/stats/:inboxId/series', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT date_trunc('day', w.sent_at)::date AS day,
             COUNT(*)::INT AS sent,
             SUM(CASE WHEN w.replied_at IS NOT NULL THEN 1 ELSE 0 END)::INT AS replied,
             SUM(CASE WHEN w.landed_in='spam' THEN 1 ELSE 0 END)::INT AS spam,
             SUM(CASE WHEN w.rescued THEN 1 ELSE 0 END)::INT AS rescued
      FROM warmup_threads w
      JOIN inboxes i ON i.id = w.sender_inbox_id
      WHERE i.user_id = $1 AND w.sender_inbox_id = $2
        AND w.sent_at > now() - interval '30 days'
      GROUP BY day ORDER BY day ASC
    `, [req.user.id, req.params.inboxId]);
    res.json({ series: rows });
  } catch (err) { next(err); }
});

export default router;
