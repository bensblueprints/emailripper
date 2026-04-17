import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { decrypt } from '../lib/crypto.js';

export class ImapSmtpAdapter {
  constructor(inbox) { this.inbox = inbox; }

  transporter() {
    return nodemailer.createTransport({
      host: this.inbox.smtp_host,
      port: this.inbox.smtp_port,
      secure: this.inbox.smtp_secure,
      auth: { user: this.inbox.smtp_user, pass: decrypt(this.inbox.smtp_pass_enc) },
    });
  }

  async imap() {
    const client = new ImapFlow({
      host: this.inbox.imap_host,
      port: this.inbox.imap_port,
      secure: true,
      auth: { user: this.inbox.imap_user, pass: decrypt(this.inbox.imap_pass_enc) },
      logger: false,
    });
    await client.connect();
    return client;
  }

  async send({ to, subject, html, text, inReplyTo, references, headers = {} }) {
    const t = this.transporter();
    const info = await t.sendMail({
      from: `"${this.inbox.display_name || ''}" <${this.inbox.email}>`.trim(),
      to, subject, text: text || undefined, html: html || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
      headers,
    });
    return { messageId: info.messageId, threadId: info.messageId };
  }

  async listRecent({ mailbox = 'INBOX', since, limit = 50 } = {}) {
    const c = await this.imap();
    try {
      await c.mailboxOpen(mailbox);
      const range = since ? { since: new Date(since) } : { all: true };
      const out = [];
      for await (const msg of c.fetch(range, { envelope: true, uid: true, flags: true })) {
        out.push({
          id: String(msg.uid),
          threadId: msg.envelope?.messageId,
          subject: msg.envelope?.subject,
          from: msg.envelope?.from?.[0]?.address,
          receivedAt: msg.envelope?.date?.getTime(),
          labels: [...(msg.flags || [])],
          folder: mailbox,
        });
        if (out.length >= limit) break;
      }
      return out;
    } finally {
      await c.logout();
    }
  }

  async markImportant(uid, mailbox = 'INBOX') {
    const c = await this.imap();
    try {
      await c.mailboxOpen(mailbox);
      await c.messageFlagsAdd({ uid }, ['\\Flagged']);
    } finally { await c.logout(); }
  }

  async moveFromSpamToInbox(uid, spamFolder = 'Spam') {
    const c = await this.imap();
    try {
      await c.mailboxOpen(spamFolder);
      await c.messageMove({ uid }, 'INBOX');
    } catch {
      // different servers name spam differently — try Junk
      await c.mailboxOpen('Junk');
      await c.messageMove({ uid }, 'INBOX');
    } finally { await c.logout(); }
  }

  async fetchBody(uid, mailbox = 'INBOX') {
    const c = await this.imap();
    try {
      await c.mailboxOpen(mailbox);
      const msg = await c.fetchOne(uid, { source: true });
      if (!msg?.source) return null;
      return simpleParser(msg.source);
    } finally { await c.logout(); }
  }

  async reply({ to, subject, text, html, inReplyTo, references }) {
    return this.send({ to, subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`, text, html, inReplyTo, references });
  }
}
