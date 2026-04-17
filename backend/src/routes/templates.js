import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
    res.json({ templates: rows });
  } catch (err) { next(err); }
});

const schema = z.object({
  name: z.string().min(1),
  subject: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO templates (user_id, name, subject, body_html, body_text, variables)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, b.name, b.subject, b.bodyHtml, b.bodyText || null, JSON.stringify(b.variables || [])]
    );
    res.json({ template: rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    const { rows } = await query(
      `UPDATE templates SET name=$1, subject=$2, body_html=$3, body_text=$4, variables=$5
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [b.name, b.subject, b.bodyHtml, b.bodyText || null, JSON.stringify(b.variables || []), req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json({ template: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM templates WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
