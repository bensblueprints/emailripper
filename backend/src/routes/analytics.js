import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/overview', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [totals, recent] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::INT FROM email_events WHERE user_id=$1 AND kind='sent') AS sent,
          (SELECT COUNT(*)::INT FROM email_events WHERE user_id=$1 AND kind='opened') AS opened,
          (SELECT COUNT(*)::INT FROM email_events WHERE user_id=$1 AND kind='clicked') AS clicked,
          (SELECT COUNT(*)::INT FROM email_events WHERE user_id=$1 AND kind='replied') AS replied,
          (SELECT COUNT(*)::INT FROM email_events WHERE user_id=$1 AND kind='bounced') AS bounced,
          (SELECT COUNT(*)::INT FROM leads WHERE user_id=$1) AS total_leads,
          (SELECT COUNT(*)::INT FROM campaigns WHERE user_id=$1 AND status='active') AS active_campaigns
      `, [userId]),
      query(`
        SELECT date_trunc('day', created_at)::date AS day, kind, COUNT(*)::INT AS n
        FROM email_events
        WHERE user_id=$1 AND created_at > now() - interval '30 days'
        GROUP BY day, kind ORDER BY day ASC
      `, [userId]),
    ]);
    res.json({ totals: totals.rows[0], series: recent.rows });
  } catch (err) { next(err); }
});

export default router;
