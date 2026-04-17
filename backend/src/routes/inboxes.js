import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt } from '../lib/crypto.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, provider, email, display_name, warmup_enabled, warmup_daily_min, warmup_daily_max,
              warmup_ramp_step, warmup_reply_rate, warmup_current_cap, daily_send_limit,
              reputation_score, status, last_error, created_at
       FROM inboxes WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ inboxes: rows });
  } catch (err) { next(err); }
});

const imapSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  imapHost: z.string(), imapPort: z.number().int().default(993),
  imapUser: z.string(), imapPass: z.string(),
  smtpHost: z.string(), smtpPort: z.number().int().default(465),
  smtpUser: z.string(), smtpPass: z.string(),
  smtpSecure: z.boolean().default(true),
});

router.post('/imap', async (req, res, next) => {
  try {
    const b = imapSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO inboxes
        (user_id, provider, email, display_name,
         imap_host, imap_port, imap_user, imap_pass_enc,
         smtp_host, smtp_port, smtp_user, smtp_pass_enc, smtp_secure)
       VALUES ($1,'imap',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (user_id, email) DO UPDATE SET
         imap_host=EXCLUDED.imap_host, imap_port=EXCLUDED.imap_port,
         imap_user=EXCLUDED.imap_user, imap_pass_enc=EXCLUDED.imap_pass_enc,
         smtp_host=EXCLUDED.smtp_host, smtp_port=EXCLUDED.smtp_port,
         smtp_user=EXCLUDED.smtp_user, smtp_pass_enc=EXCLUDED.smtp_pass_enc,
         smtp_secure=EXCLUDED.smtp_secure, status='active', updated_at=now()
       RETURNING id`,
      [req.user.id, b.email, b.displayName || null,
       b.imapHost, b.imapPort, b.imapUser, encrypt(b.imapPass),
       b.smtpHost, b.smtpPort, b.smtpUser, encrypt(b.smtpPass), b.smtpSecure]
    );
    res.json({ id: rows[0].id });
  } catch (err) { next(err); }
});

const smtpRelaySchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  smtpHost: z.string(), smtpPort: z.number().int().default(587),
  smtpUser: z.string(), smtpPass: z.string(),
  smtpSecure: z.boolean().default(false),
});

router.post('/smtp-relay', async (req, res, next) => {
  try {
    const b = smtpRelaySchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO inboxes
        (user_id, provider, email, display_name,
         smtp_host, smtp_port, smtp_user, smtp_pass_enc, smtp_secure, warmup_enabled)
       VALUES ($1,'smtp_relay',$2,$3,$4,$5,$6,$7,$8,FALSE)
       ON CONFLICT (user_id, email) DO UPDATE SET
         smtp_host=EXCLUDED.smtp_host, smtp_port=EXCLUDED.smtp_port,
         smtp_user=EXCLUDED.smtp_user, smtp_pass_enc=EXCLUDED.smtp_pass_enc,
         smtp_secure=EXCLUDED.smtp_secure, status='active', updated_at=now()
       RETURNING id`,
      [req.user.id, b.email, b.displayName || null,
       b.smtpHost, b.smtpPort, b.smtpUser, encrypt(b.smtpPass), b.smtpSecure]
    );
    res.json({ id: rows[0].id });
  } catch (err) { next(err); }
});

const warmupConfigSchema = z.object({
  warmupEnabled: z.boolean().optional(),
  warmupDailyMin: z.number().int().min(1).max(200).optional(),
  warmupDailyMax: z.number().int().min(1).max(200).optional(),
  warmupRampStep: z.number().int().min(1).max(50).optional(),
  warmupReplyRate: z.number().min(0).max(1).optional(),
  dailySendLimit: z.number().int().min(1).max(2000).optional(),
});

router.patch('/:id/warmup', async (req, res, next) => {
  try {
    const b = warmupConfigSchema.parse(req.body);
    const fields = [];
    const values = [req.user.id, req.params.id];
    let i = 3;
    const map = {
      warmupEnabled: 'warmup_enabled',
      warmupDailyMin: 'warmup_daily_min',
      warmupDailyMax: 'warmup_daily_max',
      warmupRampStep: 'warmup_ramp_step',
      warmupReplyRate: 'warmup_reply_rate',
      dailySendLimit: 'daily_send_limit',
    };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { fields.push(`${col} = $${i++}`); values.push(b[k]); }
    }
    if (!fields.length) throw new HttpError(400, 'nothing to update');
    const { rowCount } = await query(
      `UPDATE inboxes SET ${fields.join(', ')}, updated_at=now() WHERE user_id=$1 AND id=$2`,
      values
    );
    if (!rowCount) throw new HttpError(404, 'inbox not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM inboxes WHERE user_id=$1 AND id=$2`, [req.user.id, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
