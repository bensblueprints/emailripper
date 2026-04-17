import { Router } from 'express';
import { google } from 'googleapis';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt } from '../lib/crypto.js';
import { HttpError } from '../middleware/error.js';
import jwt from 'jsonwebtoken';

const router = Router();

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const MS_SCOPES = ['offline_access', 'Mail.Send', 'Mail.ReadWrite', 'User.Read'];

function googleClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function msClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || 'common'}`,
    },
  });
}

// Stateless state param signed with JWT_SECRET so native apps can launch the browser flow
// and we can verify which user initiated the connection.
function signState(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: '10m' });
}
function verifyState(s) {
  try { return jwt.verify(s, process.env.JWT_SECRET).sub; } catch { return null; }
}

router.get('/google/start', requireAuth, (req, res) => {
  const url = googleClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state: signState(req.user.id),
  });
  res.json({ url });
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const userId = verifyState(req.query.state);
    if (!userId) throw new HttpError(400, 'invalid state');
    const { tokens } = await googleClient().getToken(req.query.code);
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    await query(
      `INSERT INTO inboxes (user_id, provider, email, oauth_access, oauth_refresh, oauth_expires_at)
       VALUES ($1,'gmail',$2,$3,$4,to_timestamp($5))
       ON CONFLICT (user_id, email) DO UPDATE SET
         oauth_access=EXCLUDED.oauth_access,
         oauth_refresh=COALESCE(EXCLUDED.oauth_refresh, inboxes.oauth_refresh),
         oauth_expires_at=EXCLUDED.oauth_expires_at,
         status='active', updated_at=now()`,
      [
        userId, email, encrypt(tokens.access_token),
        tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        Math.floor((tokens.expiry_date || Date.now() + 3600_000) / 1000),
      ]
    );
    // Native app closes the browser when it sees this page
    res.send('<html><body style="background:#0a0a0a;color:#fff;font-family:system-ui;padding:40px;text-align:center"><h2>Gmail connected</h2><p>You can close this window and return to LeadRipper Warmup.</p><script>window.close();</script></body></html>');
  } catch (err) { next(err); }
});

router.get('/microsoft/start', requireAuth, async (req, res, next) => {
  try {
    const url = await msClient().getAuthCodeUrl({
      scopes: MS_SCOPES,
      redirectUri: process.env.MS_REDIRECT_URI,
      state: signState(req.user.id),
      prompt: 'consent',
    });
    res.json({ url });
  } catch (err) { next(err); }
});

router.get('/microsoft/callback', async (req, res, next) => {
  try {
    const userId = verifyState(req.query.state);
    if (!userId) throw new HttpError(400, 'invalid state');
    const tok = await msClient().acquireTokenByCode({
      code: req.query.code,
      scopes: MS_SCOPES,
      redirectUri: process.env.MS_REDIRECT_URI,
    });
    const email = tok.account?.username;
    await query(
      `INSERT INTO inboxes (user_id, provider, email, oauth_access, oauth_refresh, oauth_expires_at)
       VALUES ($1,'microsoft',$2,$3,$4,$5)
       ON CONFLICT (user_id, email) DO UPDATE SET
         oauth_access=EXCLUDED.oauth_access,
         oauth_refresh=COALESCE(EXCLUDED.oauth_refresh, inboxes.oauth_refresh),
         oauth_expires_at=EXCLUDED.oauth_expires_at,
         status='active', updated_at=now()`,
      [userId, email, encrypt(tok.accessToken), null, tok.expiresOn]
    );
    res.send('<html><body style="background:#0a0a0a;color:#fff;font-family:system-ui;padding:40px;text-align:center"><h2>Outlook connected</h2><p>You can close this window and return to LeadRipper Warmup.</p><script>window.close();</script></body></html>');
  } catch (err) { next(err); }
});

export default router;
