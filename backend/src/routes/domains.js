import { Router } from 'express';
import { z } from 'zod';
import dns from 'dns/promises';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

async function checkDns(domain, dkimSelector) {
  const result = {
    spf: { status: 'missing', record: null },
    dmarc: { status: 'missing', record: null },
    dkim: { status: 'unknown', record: null },
  };
  try {
    const txt = (await dns.resolveTxt(domain)).map(r => r.join(''));
    const spf = txt.find(r => r.toLowerCase().startsWith('v=spf1'));
    if (spf) result.spf = { status: 'ok', record: spf };
  } catch { /* no TXT */ }
  try {
    const txt = (await dns.resolveTxt(`_dmarc.${domain}`)).map(r => r.join(''));
    const dmarc = txt.find(r => r.toLowerCase().startsWith('v=dmarc1'));
    if (dmarc) {
      const policy = /p=([^;\s]+)/i.exec(dmarc)?.[1]?.toLowerCase() || 'none';
      result.dmarc = { status: policy === 'none' ? 'weak' : 'ok', record: dmarc };
    }
  } catch { /* no _dmarc */ }
  if (dkimSelector) {
    try {
      const txt = (await dns.resolveTxt(`${dkimSelector}._domainkey.${domain}`)).map(r => r.join(''));
      const dkim = txt.find(r => r.toLowerCase().includes('v=dkim1') || r.toLowerCase().includes('p='));
      if (dkim) result.dkim = { status: 'ok', record: dkim };
      else result.dkim = { status: 'missing', record: null };
    } catch { result.dkim = { status: 'missing', record: null }; }
  }
  return result;
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.*,
              (SELECT COUNT(*) FROM inboxes i
                 WHERE i.user_id = d.user_id
                   AND split_part(i.email, '@', 2) = d.domain) AS inbox_count
       FROM sending_domains d
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json({ domains: rows });
  } catch (err) { next(err); }
});

// Auto-discover: create a sending_domain row for every unique inbox email domain that isn't tracked yet
router.post('/sync', async (req, res, next) => {
  try {
    await query(
      `INSERT INTO sending_domains (user_id, domain)
       SELECT DISTINCT i.user_id, split_part(i.email, '@', 2)
         FROM inboxes i
        WHERE i.user_id = $1
       ON CONFLICT (user_id, domain) DO NOTHING`,
      [req.user.id]
    );
    const { rows } = await query(
      `SELECT * FROM sending_domains WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ domains: rows });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'invalid domain'),
  dkimSelector: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO sending_domains (user_id, domain, dkim_selector)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, domain) DO UPDATE SET dkim_selector = EXCLUDED.dkim_selector, updated_at = now()
       RETURNING *`,
      [req.user.id, b.domain.toLowerCase(), b.dkimSelector || null]
    );
    res.json({ domain: rows[0] });
  } catch (err) { next(err); }
});

router.post('/:id/check', async (req, res, next) => {
  try {
    const { rows: cur } = await query(
      `SELECT domain, dkim_selector FROM sending_domains WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!cur[0]) throw new HttpError(404, 'domain not found');
    const dnsRes = await checkDns(cur[0].domain, cur[0].dkim_selector);

    // Aggregate reputation from inboxes on this domain
    const { rows: repRows } = await query(
      `SELECT COALESCE(AVG(reputation_score), 50)::int AS rep
         FROM inboxes
        WHERE user_id = $1 AND split_part(email, '@', 2) = $2`,
      [req.user.id, cur[0].domain]
    );
    const rep = repRows[0].rep;

    const { rows } = await query(
      `UPDATE sending_domains SET
         spf_status = $3, spf_record = $4,
         dkim_status = $5, dkim_record = $6,
         dmarc_status = $7, dmarc_record = $8,
         reputation_score = $9, last_checked_at = now(), updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id,
       dnsRes.spf.status, dnsRes.spf.record,
       dnsRes.dkim.status, dnsRes.dkim.record,
       dnsRes.dmarc.status, dnsRes.dmarc.record,
       rep]
    );
    res.json({ domain: rows[0] });
  } catch (err) { next(err); }
});

const warmupSchema = z.object({
  warmupEnabled: z.boolean().optional(),
  dailyCap: z.number().int().min(1).max(5000).optional(),
  rampStep: z.number().int().min(1).max(200).optional(),
  currentCap: z.number().int().min(1).max(5000).optional(),
  maxCap: z.number().int().min(1).max(5000).optional(),
  dkimSelector: z.string().optional(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const b = warmupSchema.parse(req.body);
    const map = {
      warmupEnabled: 'warmup_enabled',
      dailyCap: 'daily_cap',
      rampStep: 'ramp_step',
      currentCap: 'current_cap',
      maxCap: 'max_cap',
      dkimSelector: 'dkim_selector',
    };
    const fields = []; const values = [req.user.id, req.params.id]; let i = 3;
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { fields.push(`${col} = $${i++}`); values.push(b[k]); }
    }
    if (!fields.length) throw new HttpError(400, 'nothing to update');
    const { rows } = await query(
      `UPDATE sending_domains SET ${fields.join(', ')}, updated_at = now()
        WHERE user_id = $1 AND id = $2 RETURNING *`,
      values
    );
    if (!rows[0]) throw new HttpError(404, 'domain not found');
    res.json({ domain: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM sending_domains WHERE user_id=$1 AND id=$2`, [req.user.id, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
