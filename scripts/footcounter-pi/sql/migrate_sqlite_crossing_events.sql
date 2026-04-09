-- Run ONCE on the Pi against the local SQLite DB (e.g. events.sqlite).
-- Adds idempotent sync fields for per-event Supabase upload.

ALTER TABLE crossing_events ADD COLUMN client_event_id TEXT;
ALTER TABLE crossing_events ADD COLUMN synced_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crossing_client_event_id ON crossing_events (client_event_id)
  WHERE client_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crossing_synced ON crossing_events (synced_at);
