import { google } from 'googleapis';
import { query } from '../db/pool.js';
import { decrypt, encrypt } from '../lib/crypto.js';

export class GmailAdapter {
  constructor(inbox) { this.inbox = inbox; }

  async client() {
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth.setCredentials({
      access_token: decrypt(this.inbox.oauth_access),
      refresh_token: this.inbox.oauth_refresh ? decrypt(this.inbox.oauth_refresh) : undefined,
      expiry_date: this.inbox.oauth_expires_at ? new Date(this.inbox.oauth_expires_at).getTime() : undefined,
    });
    oauth.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await query(
          `UPDATE inboxes SET oauth_access=$1,
             oauth_expires_at=to_timestamp($2),
             oauth_refresh=COALESCE($3, oauth_refresh),
             updated_at=now()
           WHERE id=$4`,
          [
            encrypt(tokens.access_token),
            Math.floor((tokens.expiry_date || Date.now() + 3600_000) / 1000),
            tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            this.inbox.id,
          ]
        );
      }
    });
    return google.gmail({ version: 'v1', auth: oauth });
  }

  async send({ to, subject, html, text, inReplyTo, references, headers = {} }) {
    const g = await this.client();
    const boundary = 'lr' + Math.random().toString(36).slice(2);
    const mime = [
      `From: ${this.inbox.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
      references ? `References: ${references}` : '',
      ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text || stripHtml(html || ''),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html || `<p>${text || ''}</p>`,
      '',
      `--${boundary}--`,
    ].filter(Boolean).join('\r\n');

    const raw = Buffer.from(mime).toString('base64url');
    const resp = await g.users.messages.send({ userId: 'me', requestBody: { raw } });
    return { messageId: resp.data.id, threadId: resp.data.threadId };
  }

  async listRecent({ since, maxResults = 50, query: q = '' } = {}) {
    const g = await this.client();
    const sinceQ = since ? `after:${Math.floor(new Date(since).getTime() / 1000)}` : '';
    const resp = await g.users.messages.list({
      userId: 'me', maxResults, q: [q, sinceQ].filter(Boolean).join(' '),
    });
    const ids = resp.data.messages || [];
    const out = [];
    for (const { id } of ids) {
      const m = await g.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Subject', 'From'] });
      const h = Object.fromEntries((m.data.payload?.headers || []).map(x => [x.name, x.value]));
      out.push({
        id: m.data.id,
        threadId: m.data.threadId,
        subject: h.Subject,
        from: h.From,
        snippet: m.data.snippet,
        labels: m.data.labelIds || [],
        receivedAt: Number(m.data.internalDate),
      });
    }
    return out;
  }

  async markImportant(id) {
    const g = await this.client();
    await g.users.messages.modify({ userId: 'me', id, requestBody: { addLabelIds: ['IMPORTANT', 'STARRED'] } });
  }

  async moveFromSpamToInbox(id) {
    const g = await this.client();
    await g.users.messages.modify({
      userId: 'me', id,
      requestBody: { addLabelIds: ['INBOX'], removeLabelIds: ['SPAM'] },
    });
  }

  async reply({ threadId, to, subject, text, html, inReplyTo, references }) {
    return this.send({ to, subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`, text, html, inReplyTo, references });
  }
}

function stripHtml(s) { return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
