import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

// Single-user local mode: auto-resolve to a default user, ensuring it exists on first call.
const DEFAULT_EMAIL = 'local@emailripper.app';
let cachedUserId = null;

async function ensureDefaultUser() {
  if (cachedUserId) return cachedUserId;
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [DEFAULT_EMAIL]);
  if (existing.rows[0]) {
    cachedUserId = existing.rows[0].id;
    return cachedUserId;
  }
  const hash = await bcrypt.hash('local', 10);
  const created = await pool.query(
    'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
    [DEFAULT_EMAIL, hash, 'Local User'],
  );
  cachedUserId = created.rows[0].id;
  return cachedUserId;
}

export async function requireAuth(req, _res, next) {
  try {
    const id = await ensureDefaultUser();
    req.user = { id, email: DEFAULT_EMAIL };
    next();
  } catch (err) {
    next(err);
  }
}

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, process.env.JWT_SECRET || 'local-dev', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}
