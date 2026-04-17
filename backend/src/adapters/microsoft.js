import { ConfidentialClientApplication } from '@azure/msal-node';
import { query } from '../db/pool.js';
import { decrypt, encrypt } from '../lib/crypto.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['offline_access', 'Mail.Send', 'Mail.ReadWrite', 'User.Read'];

export class MicrosoftAdapter {
  constructor(inbox) { this.inbox = inbox; }

  async token() {
    const now = Date.now();
    const exp = this.inbox.oauth_expires_at ? new Date(this.inbox.oauth_expires_at).getTime() : 0;
    if (this.inbox.oauth_access && exp - now > 60_000) return decrypt(this.inbox.oauth_access);

    const msal = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MS_CLIENT_ID,
        clientSecret: process.env.MS_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || 'common'}`,
      },
    });
    const refresh = this.inbox.oauth_refresh ? decrypt(this.inbox.oauth_refresh) : null;
    if (!refresh) throw new Error('microsoft inbox missing refresh token; reconnect');
    const r = await msal.acquireTokenByRefreshToken({ refreshToken: refresh, scopes: SCOPES });
    await query(
      `UPDATE inboxes SET oauth_access=$1, oauth_expires_at=$2, updated_at=now() WHERE id=$3`,
      [encrypt(r.accessToken), r.expiresOn, this.inbox.id]
    );
    return r.accessToken;
  }

  async req(path, { method = 'GET', body, headers = {} } = {}) {
    const token = await this.token();
    const resp = await fetch(`${GRAPH}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`graph ${method} ${path} -> ${resp.status} ${t}`);
    }
    if (resp.status === 204) return null;
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('json') ? resp.json() : resp.text();
  }

  async send({ to, subject, html, text, inReplyTo }) {
    const message = {
      subject,
      body: { contentType: 'HTML', content: html || `<p>${text || ''}</p>` },
      toRecipients: [{ emailAddress: { address: to } }],
      internetMessageHeaders: inReplyTo ? [{ name: 'In-Reply-To', value: inReplyTo }] : undefined,
    };
    // Send & save to Sent Items
    await this.req('/me/sendMail', { method: 'POST', body: { message, saveToSentItems: true } });
    // Graph /sendMail does not return an id. Fetch latest sent message matching subject+to.
    const sent = await this.req(
      `/me/mailFolders/SentItems/messages?$top=5&$select=id,conversationId,internetMessageId,subject,toRecipients&$orderby=sentDateTime desc`
    );
    const match = (sent.value || []).find(m =>
      m.subject === subject && (m.toRecipients || []).some(r => r.emailAddress?.address?.toLowerCase() === to.toLowerCase())
    );
    return { messageId: match?.internetMessageId || match?.id || null, threadId: match?.conversationId || null };
  }

  async listRecent({ folder = 'Inbox', maxResults = 50, since } = {}) {
    const filter = since ? `&$filter=receivedDateTime ge ${new Date(since).toISOString()}` : '';
    const r = await this.req(
      `/me/mailFolders/${folder}/messages?$top=${maxResults}&$select=id,conversationId,subject,from,bodyPreview,isRead,receivedDateTime${filter}`
    );
    return (r.value || []).map(m => ({
      id: m.id, threadId: m.conversationId, subject: m.subject,
      from: m.from?.emailAddress?.address, snippet: m.bodyPreview,
      receivedAt: new Date(m.receivedDateTime).getTime(),
      folder,
    }));
  }

  async markImportant(id) {
    await this.req(`/me/messages/${id}`, { method: 'PATCH', body: { importance: 'high', flag: { flagStatus: 'flagged' } } });
  }

  async moveFromSpamToInbox(id) {
    await this.req(`/me/messages/${id}/move`, { method: 'POST', body: { destinationId: 'inbox' } });
  }

  async reply({ messageId, text, html }) {
    await this.req(`/me/messages/${messageId}/reply`, {
      method: 'POST',
      body: { comment: text || stripHtml(html || '') },
    });
    return { messageId: null, threadId: null };
  }
}

function stripHtml(s) { return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
