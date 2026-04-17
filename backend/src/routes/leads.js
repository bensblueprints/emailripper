import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const params = [req.user.id];
    let where = `user_id=$1`;
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (email ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2 OR company ILIKE $2)`;
    }
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ leads: rows });
  } catch (err) { next(err); }
});

const leadSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom: z.record(z.any()).optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const b = leadSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO leads (user_id, email, first_name, last_name, company, job_title, phone, tags, custom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, email) DO UPDATE SET
         first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
         company=EXCLUDED.company, job_title=EXCLUDED.job_title,
         phone=EXCLUDED.phone, tags=EXCLUDED.tags, custom=EXCLUDED.custom
       RETURNING *`,
      [req.user.id, b.email.toLowerCase(), b.firstName || null, b.lastName || null,
       b.company || null, b.jobTitle || null, b.phone || null,
       b.tags || [], b.custom || {}]
    );
    res.json({ lead: rows[0] });
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  try {
    const arr = z.array(leadSchema).parse(req.body.leads || []);
    let inserted = 0;
    for (const b of arr) {
      try {
        await query(
          `INSERT INTO leads (user_id, email, first_name, last_name, company, job_title, phone, tags, custom)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (user_id, email) DO NOTHING`,
          [req.user.id, b.email.toLowerCase(), b.firstName || null, b.lastName || null,
           b.company || null, b.jobTitle || null, b.phone || null, b.tags || [], b.custom || {}]
        );
        inserted++;
      } catch { /* ignore */ }
    }
    res.json({ inserted });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM leads WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
