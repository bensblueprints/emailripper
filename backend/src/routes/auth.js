import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional(),
  company: z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(body.password, 11);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, company)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, full_name, company, plan`,
      [body.email.toLowerCase(), hash, body.fullName || null, body.company || null]
    );
    if (!rows[0]) throw new HttpError(409, 'email already registered');
    res.json({ user: rows[0], token: signToken(rows[0]) });
  } catch (err) { next(err); }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [body.email.toLowerCase()]);
    const user = rows[0];
    if (!user) throw new HttpError(401, 'invalid credentials');
    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) throw new HttpError(401, 'invalid credentials');
    res.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, company: user.company, plan: user.plan },
      token: signToken(user),
    });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, email, full_name, company, plan FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) throw new HttpError(404, 'not found');
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

export default router;
