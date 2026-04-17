import { pool } from './pool.js';
import { logger } from '../lib/logger.js';

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id           BIGSERIAL PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name    TEXT,
    company      TEXT,
    plan         TEXT NOT NULL DEFAULT 'starter',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS inboxes (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         TEXT NOT NULL CHECK (provider IN ('gmail','microsoft','imap','smtp_relay')),
    email            TEXT NOT NULL,
    display_name     TEXT,
    -- OAuth
    oauth_access     TEXT,
    oauth_refresh    TEXT,
    oauth_expires_at TIMESTAMPTZ,
    -- IMAP / SMTP
    imap_host        TEXT,
    imap_port        INT,
    imap_user        TEXT,
    imap_pass_enc    TEXT,
    smtp_host        TEXT,
    smtp_port        INT,
    smtp_user        TEXT,
    smtp_pass_enc    TEXT,
    smtp_secure      BOOLEAN DEFAULT TRUE,
    -- Warming config
    warmup_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    warmup_daily_min INT NOT NULL DEFAULT 5,
    warmup_daily_max INT NOT NULL DEFAULT 40,
    warmup_ramp_step INT NOT NULL DEFAULT 3,
    warmup_reply_rate REAL NOT NULL DEFAULT 0.4,
    warmup_current_cap INT NOT NULL DEFAULT 5,
    -- Send limits for campaigns
    daily_send_limit INT NOT NULL DEFAULT 100,
    reputation_score INT NOT NULL DEFAULT 50,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','disconnected')),
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, email)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_inboxes_warmup_pool ON inboxes(warmup_enabled, status) WHERE warmup_enabled = TRUE`,

  `CREATE TABLE IF NOT EXISTS templates (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    body_html   TEXT NOT NULL,
    body_text   TEXT,
    variables   JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS campaigns (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
    from_inbox_id BIGINT REFERENCES inboxes(id) ON DELETE SET NULL,
    schedule     JSONB NOT NULL DEFAULT '{"timezone":"UTC","weekdays":[1,2,3,4,5],"start":"09:00","end":"17:00"}',
    tracking     JSONB NOT NULL DEFAULT '{"opens":true,"clicks":true}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS sequence_steps (
    id            BIGSERIAL PRIMARY KEY,
    campaign_id   BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_order    INT NOT NULL,
    delay_days    INT NOT NULL DEFAULT 3,
    condition     TEXT NOT NULL DEFAULT 'always' CHECK (condition IN ('always','no_reply','no_open')),
    subject       TEXT NOT NULL,
    body_html     TEXT NOT NULL,
    body_text     TEXT,
    UNIQUE (campaign_id, step_order)
  )`,

  `CREATE TABLE IF NOT EXISTS leads (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    first_name   TEXT,
    last_name    TEXT,
    company      TEXT,
    job_title    TEXT,
    phone        TEXT,
    tags         TEXT[] NOT NULL DEFAULT '{}',
    custom       JSONB NOT NULL DEFAULT '{}',
    source       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, email)
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_leads (
    id            BIGSERIAL PRIMARY KEY,
    campaign_id   BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id       BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','replied','bounced','unsubscribed','completed')),
    current_step  INT NOT NULL DEFAULT 0,
    next_send_at  TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    UNIQUE (campaign_id, lead_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_campaign_leads_due ON campaign_leads(next_send_at) WHERE status IN ('pending','in_progress')`,

  `CREATE TABLE IF NOT EXISTS email_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inbox_id    BIGINT REFERENCES inboxes(id) ON DELETE SET NULL,
    campaign_id BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
    lead_id     BIGINT REFERENCES leads(id) ON DELETE SET NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('sent','delivered','opened','clicked','replied','bounced','complained','unsubscribed','warmup_sent','warmup_received','warmup_replied','warmup_rescued_from_spam')),
    provider_message_id TEXT,
    thread_id   TEXT,
    meta        JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_email_events_user_kind_time ON email_events(user_id, kind, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_email_events_inbox_time ON email_events(inbox_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS warmup_threads (
    id               BIGSERIAL PRIMARY KEY,
    sender_inbox_id  BIGINT NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    receiver_inbox_id BIGINT NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    subject          TEXT NOT NULL,
    provider_message_id TEXT,
    thread_id        TEXT,
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    replied_at       TIMESTAMPTZ,
    landed_in        TEXT CHECK (landed_in IN ('inbox','spam','promotions','unknown')),
    rescued          BOOLEAN DEFAULT FALSE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_warmup_threads_sender_day ON warmup_threads(sender_inbox_id, sent_at DESC)`,
];

export async function migrate() {
  for (const s of STATEMENTS) {
    await pool.query(s);
  }
  logger.info('database migrations complete');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
