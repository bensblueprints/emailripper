import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0),
  condition: z.enum(['always', 'no_reply', 'no_open']).default('always'),
  subject: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string().optional(),
});

const replaceSchema = z.object({
  campaignId: z.number().int(),
  steps: z.array(stepSchema).min(1),
});

router.post('/replace', async (req, res, next) => {
  try {
    const b = replaceSchema.parse(req.body);
    // Verify ownership
    const { rows } = await query(`SELECT id FROM campaigns WHERE id=$1 AND user_id=$2`, [b.campaignId, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'campaign not found' });
    await tx(async (c) => {
      await c.query(`DELETE FROM sequence_steps WHERE campaign_id=$1`, [b.campaignId]);
      for (const s of b.steps) {
        await c.query(
          `INSERT INTO sequence_steps (campaign_id, step_order, delay_days, condition, subject, body_html, body_text)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [b.campaignId, s.stepOrder, s.delayDays, s.condition, s.subject, s.bodyHtml, s.bodyText || null]
        );
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
