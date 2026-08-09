-- ============================================================================
-- Diyar Visitor Widget — D1 Schema
-- ============================================================================
-- Run once, after creating the D1 database, via:
--   wrangler d1 execute diyar_visitor_db --remote --file=./schema.sql
--
-- Design notes:
--   - `visits` stores at most ONE row per (visitor_hash, visit_date) thanks
--     to the unique index below. Every field except `id` is derived from a
--     real HTTP request the Worker received — nothing here is seeded or
--     synthetic.
--   - `visitor_hash` is SHA-256(IP + User-Agent + calendar day). The raw IP
--     address is never written to this database — only its daily-rotating
--     hash, which is enough to deduplicate a same-day repeat visit without
--     retaining anything personally identifying long-term.
--   - `sessions` is a separate, much smaller table that always reflects the
--     single most recent hit per visitor (upserted on every request), used
--     only to compute the "online now" figure via a short time window.
-- ============================================================================

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_hash TEXT NOT NULL,
  visit_date TEXT NOT NULL,   -- 'YYYY-MM-DD', Asia/Tehran calendar day
  ts INTEGER NOT NULL         -- unix epoch milliseconds of this hit
);

-- Guarantees a visitor is only ever counted once per calendar day, no
-- matter how many pages they view or how many times embed.js's beacon
-- fires for them that day.
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_unique_daily
  ON visits (visitor_hash, visit_date);

-- Speeds up the today/yesterday/week/month range queries in worker/src/index.js.
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits (visit_date);

CREATE TABLE IF NOT EXISTS sessions (
  visitor_hash TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL  -- unix epoch milliseconds
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen);
