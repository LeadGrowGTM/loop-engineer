-- triage.db schema
-- SQLite complement to the markdown KB. Source of truth for structured run/event data.
-- Markdown kb/ remains source of truth for durable knowledge.

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            TEXT    NOT NULL,              -- ISO 8601
  type          TEXT    NOT NULL,              -- 'goal' | 'automation' | 'overnight' | 'manual'
  label         TEXT    NOT NULL,              -- e.g. "write-goal-prompt cycle 2"
  verdict       TEXT,                          -- 'PASS' | 'ITERATE' | 'PLATEAU' | null
  reward_signal REAL,                          -- e.g. 4.2
  cycle_log     TEXT,                          -- abs path to CYCLE_LOG.md (if harness run)
  needs_review  INTEGER NOT NULL DEFAULT 0,    -- 1 = needs human eyes
  status        TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed' | 'dismissed'
  reviewed_at   TEXT                           -- ISO 8601 when marked reviewed/dismissed
);

CREATE TABLE IF NOT EXISTS signals (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id   INTEGER REFERENCES runs(id) ON DELETE CASCADE,
  ts       TEXT    NOT NULL,
  category TEXT    NOT NULL,  -- 'blocker' | 'decision' | 'observation' | 'plateau' | 'error'
  message  TEXT    NOT NULL,
  status   TEXT    NOT NULL DEFAULT 'open'  -- 'open' | 'actioned' | 'dismissed'
);

CREATE INDEX IF NOT EXISTS idx_runs_status   ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_ts       ON runs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_signals_run   ON signals(run_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
