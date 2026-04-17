import nodemailer from 'nodemailer';
import { decrypt } from '../lib/crypto.js';

/**
 * SMTP relays (SendGrid, Mailgun, SES) are send-only.
 * Warming does not apply — these services have their own IP/domain reputation systems.
 */
export class SmtpRelayAdapter {
  constructor(inbox) { this.inbox = inbox; }

  transporter() {
    return nodemailer.createTransport({
      host: this.inbox.smtp_host,
      port: this.inbox.smtp_port,
      secure: this.inbox.smtp_secure,
      auth: { user: this.inbox.smtp_user, pass: decrypt(this.inbox.smtp_pass_enc) },
    });
  }

  async send({ to, subject, html, text, inReplyTo, references, headers = {} }) {
    const info = await this.transporter().sendMail({
      from: `"${this.inbox.display_name || ''}" <${this.inbox.email}>`.trim(),
      to, subject, text: text || undefined, html: html || undefined,
      inReplyTo, references, headers,
    });
    return { messageId: info.messageId, threadId: info.messageId };
  }

  async listRecent() { return []; }
  async markImportant() {}
  async moveFromSpamToInbox() {}
  async reply() { throw new Error('SMTP relay inboxes cannot receive replies'); }
}
