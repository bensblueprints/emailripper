# LeadRipper Warmup — Backend

Node 20+, Express, Postgres, Redis (BullMQ).

## Setup

```bash
cp .env.example .env
# fill in Google / Microsoft OAuth credentials, generate ENCRYPTION_KEY and JWT_SECRET
openssl rand -hex 32   # -> ENCRYPTION_KEY
openssl rand -hex 64   # -> JWT_SECRET

npm install
npm run migrate
npm run dev       # API on :4100
npm run worker    # BullMQ workers (separate terminal)
```

## Requirements

- Postgres 14+
- Redis 6+

## Key endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT |
| GET | `/api/inboxes` | List user inboxes |
| POST | `/api/inboxes/imap` | Add IMAP+SMTP inbox |
| POST | `/api/inboxes/smtp-relay` | Add SendGrid/SES/etc sending inbox |
| GET | `/api/oauth/google/start` | Start Gmail OAuth (returns URL to open) |
| GET | `/api/oauth/microsoft/start` | Start Microsoft 365 OAuth |
| PATCH | `/api/inboxes/:id/warmup` | Update warming config for an inbox |
| GET | `/api/warmup/stats` | 14-day warming stats per inbox |
| GET | `/api/warmup/stats/:id/series` | Daily series for one inbox |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create |
| POST | `/api/campaigns/:id/start` | Activate |
| POST | `/api/sequences/replace` | Replace sequence steps for a campaign |
| GET/POST/PUT/DELETE | `/api/templates` | Template CRUD |
| GET/POST/DELETE | `/api/leads` | Lead CRUD, `POST /api/leads/bulk` for imports |
| GET | `/api/analytics/overview` | Dashboard data |

## Warming engine

See [`src/services/warmup.js`](src/services/warmup.js). Scheduler in [`src/workers/index.js`](src/workers/index.js) ticks every 5 min, spraying sends through the day rather than bursting. Daily `rampUpCaps` advances each inbox's per-day cap when health is good and pulls it back if spam-rate rises.
