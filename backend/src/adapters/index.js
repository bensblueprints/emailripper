import { GmailAdapter } from './gmail.js';
import { MicrosoftAdapter } from './microsoft.js';
import { ImapSmtpAdapter } from './imap-smtp.js';
import { SmtpRelayAdapter } from './smtp-relay.js';

export function adapterFor(inbox) {
  switch (inbox.provider) {
    case 'gmail': return new GmailAdapter(inbox);
    case 'microsoft': return new MicrosoftAdapter(inbox);
    case 'imap': return new ImapSmtpAdapter(inbox);
    case 'smtp_relay': return new SmtpRelayAdapter(inbox);
    default: throw new Error(`unknown provider: ${inbox.provider}`);
  }
}

/**
 * Unified adapter contract:
 *  send({ to, subject, html, text, inReplyTo?, references?, headers? }) => { messageId, threadId }
 *  listRecent({ since, mailbox? }) => [{ id, threadId, from, subject, snippet, labels, receivedAt }]
 *  markImportant(id)
 *  reply({ threadId, messageId, text, html })
 *  moveFromSpamToInbox(id)
 */
