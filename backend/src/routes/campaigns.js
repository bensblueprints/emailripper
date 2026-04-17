import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT c.*, i.email AS from_email,
             (SELECT COUNT(*)::INT FROM campaign_leads WHERE campaign_id=c.id) AS lead_count,
             (SELECT COUNT(*)::INT FROM email_events WHERE campaign_id=c.id AND kind='sent') AS sent_count,
             (SELECT COUNT(*)::INT FROM email_events WHERE campaign_id=c.id AND kind='opened') AS opened_count,
             (SELECT COUNT(*)::INT FROM email_events WHERE campaign_id=c.id AND kind='replied') AS replied_count
      FROM campaigns c
      LEFT JOIN inboxes i ON i.id = c.from_inbox_id
      WHERE c.user_id = $1 ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json({ campaigns: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM campaigns WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    if (!rows[0]) throw new HttpError(404, 'not found');
    const { rows: steps } = await query(`SELECT * FROM sequence_steps WHERE campaign_id=$1 ORDER BY step_order`, [req.params.id]);
    res.json({ campaign: rows[0], steps });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fromInboxId: z.number().int().optional(),
  schedule: z.any().optional(),
  tracking: z.any().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO campaigns (user_id, name, description, from_inbox_id, schedule, tracking)
       VALUES ($1,$2,$3,$4, COALESCE($5, '{"timezone":"UTC","weekdays":[1,2,3,4,5],"start":"09:00","end":"17:00"}'::jsonb),
                           COALESCE($6, '{"opens":true,"clicks":true}'::jsonb))
       RETURNING *`,
      [req.user.id, b.name, b.description || null, b.fromInboxId || null, b.schedule || null, b.tracking || null]
    );
    res.json({ campaign: rows[0] });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = [];
    const vals = [req.params.id, req.user.id];
    let i = 3;
    const map = { name: 'name', description: 'description', fromInboxId: 'from_inbox_id', status: 'status', schedule: 'schedule', tracking: 'tracking' };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { fields.push(`${col}=$${i++}`); vals.push(b[k]); }
    }
    if (!fields.length) throw new HttpError(400, 'nothing to update');
    const { rows } = await query(
      `UPDATE campaigns SET ${fields.join(', ')}, updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`,
      vals
    );
    if (!rows[0]) throw new HttpError(404, 'not found');
    res.json({ campaign: rows[0] });
  } catch (err) { next(err); }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    await tx(async (c) => {
      const { rows } = await c.query(`SELECT * FROM campaigns WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
      if (!rows[0]) throw new HttpError(404, 'not found');
      if (!rows[0].from_inbox_id) throw new HttpError(400, 'campaign needs a from_inbox');
      await c.query(`UPDATE campaigns SET status='active', updated_at=now() WHERE id=$1`, [req.params.id]);
      // Set next_send_at = now for any unsent lead attached to this campaign
      await c.query(
        `UPDATE campaign_leads SET next_send_at = now() WHERE campaign_id=$1 AND status='pending' AND next_send_at IS NULL`,
        [req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/pause', async (req, res, next) => {
  try {
    await query(`UPDATE campaigns SET status='paused', updated_at=now() WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/leads', async (req, res, next) => {
  try {
    const ids = z.array(z.number().int()).parse(req.body.leadIds || []);
    if (!ids.length) return res.json({ added: 0 });
    const { rows } = await query(
      `INSERT INTO campaign_leads (campaign_id, lead_id, next_send_at)
       SELECT $1, l.id, NULL FROM leads l
       WHERE l.user_id = $2 AND l.id = ANY($3)
       ON CONFLICT (campaign_id, lead_id) DO NOTHING
       RETURNING id`,
      [req.params.id, req.user.id, ids]
    );
    res.json({ added: rows.length });
  } catch (err) { next(err); }
});

export default router;
