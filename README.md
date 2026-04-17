# LeadRipper Warmup

Native desktop cold email + inbox warming platform. Part of the LeadRipper product family.

## What's in this repo

```
leadripper-warmup/
├── backend/    Node.js + Express + Postgres. Warming network, OAuth, campaign/sequence engine.
├── windows/    C# / WPF / .NET 8 desktop app.
├── mac/        Swift / SwiftUI desktop app (Xcode project).
├── shared/     OpenAPI schema and shared contracts.
└── docs/       Architecture notes.
```

## Architecture overview

```
┌──────────────────────┐        ┌──────────────────────┐
│  Windows WPF client  │        │   Mac SwiftUI client │
└─────────┬────────────┘        └─────────┬────────────┘
          │  HTTPS (JSON, Bearer JWT)     │
          └──────────────┬────────────────┘
                         ▼
          ┌──────────────────────────────┐
          │  Node.js backend (Express)   │
          │  - Auth (JWT)                │
          │  - Inbox OAuth (Gmail MS365) │
          │  - Campaigns / sequences     │
          │  - Warmup network pool       │
          │  - BullMQ workers            │
          └──────┬──────────────┬────────┘
                 ▼              ▼
         ┌────────────┐   ┌────────────┐
         │ Postgres   │   │ Redis      │
         └────────────┘   └────────────┘
                 ▲
                 │
         ┌───────┴──────────┐
         │ Worker pool      │
         │ - warmup-sender  │
         │ - warmup-replier │
         │ - campaign-send  │
         │ - inbox-sync     │
         └──────────────────┘
```

## Supported providers

- Google Workspace / Gmail (OAuth 2.0 + Gmail API)
- Microsoft 365 / Outlook (OAuth 2.0 + Microsoft Graph)
- Generic IMAP + SMTP (Zoho, FastMail, custom domains)
- SMTP relays (SendGrid, Mailgun, Amazon SES) — campaign sending only, not peer warmup

## Warming strategy

1. **Peer network.** Every connected inbox opts into the pool. The scheduler picks pairs of inboxes inside the pool and sends short, human-looking messages between them.
2. **Gradual ramp-up.** Per-inbox daily cap starts at a user-defined floor (default 5/day) and grows by a configured step (default +3/day) up to the ceiling (default 40/day).
3. **Engagement loop.** Receiving inbox reads, marks important, replies in-thread, and (if the message hits spam) moves it back to inbox. All of this uses provider-native APIs — no IMAP hacks where a native API exists.
4. **Reputation score.** 0–100 per inbox, computed from spam-rate, reply-success, thread-depth, bounce-rate over the last 14 days.

## Build

See each subproject's README:

- [`backend/README.md`](backend/README.md)
- [`windows/README.md`](windows/README.md)
- [`mac/README.md`](mac/README.md)
