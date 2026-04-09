#!/usr/bin/env python3
"""
Upload unsynced crossing_events from Pi SQLite to main-app POST /api/footcounter/sync.

Use as catch-up when per-event POST from preview fails (synced_at stays NULL).

Environment (e.g. /opt/footcounter/config.env):
  FOOTCOUNTER_DB_PATH=/var/lib/footcounter/events.sqlite
  FOOTCOUNTER_SYNC_URL=https://your-app.vercel.app/api/footcounter/sync
  FOOTCOUNTER_SYNC_SECRET=long-random-secret
  FOOTCOUNTER_DEVICE_SLUG=default

Cron (safety net, e.g. every 10 minutes):
  */10 * * * * /usr/bin/python3 /opt/footcounter/sync_to_supabase.py >> /var/log/footcounter-sync.log 2>&1
"""
from __future__ import annotations

import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from footcounter_sync_client import load_footcounter_env, post_sync_events


def ensure_columns(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("SELECT client_event_id, synced_at FROM crossing_events LIMIT 1")
    except sqlite3.OperationalError:
        conn.executescript(
            """
            ALTER TABLE crossing_events ADD COLUMN client_event_id TEXT;
            ALTER TABLE crossing_events ADD COLUMN synced_at TEXT;
            """
        )
        conn.commit()


def main() -> None:
    load_footcounter_env()

    db_path = Path(os.environ.get("FOOTCOUNTER_DB_PATH", "/var/lib/footcounter/events.sqlite"))
    url = os.environ.get("FOOTCOUNTER_SYNC_URL", "").strip()
    secret = os.environ.get("FOOTCOUNTER_SYNC_SECRET", "").strip()
    slug = os.environ.get("FOOTCOUNTER_DEVICE_SLUG", "default").strip()

    if not url or not secret:
        print("FOOTCOUNTER_SYNC_URL and FOOTCOUNTER_SYNC_SECRET required", file=sys.stderr)
        sys.exit(1)

    if not db_path.is_file():
        print(f"DB missing: {db_path}", file=sys.stderr)
        sys.exit(0)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    ensure_columns(conn)

    cur = conn.execute(
        """
        SELECT id, ts_utc, direction, confidence, client_event_id
        FROM crossing_events
        WHERE synced_at IS NULL
        ORDER BY id ASC
        LIMIT 200
        """
    )
    rows = cur.fetchall()
    if not rows:
        conn.close()
        print("Nothing to sync")
        return

    events = []
    row_ids: list[int] = []

    for r in rows:
        rid = r["id"]
        direction = (r["direction"] or "").lower().strip()
        if direction not in ("in", "out"):
            conn.execute(
                "UPDATE crossing_events SET synced_at = ? WHERE id = ?",
                ("skipped-not-in-out", rid),
            )
            continue

        cid = (r["client_event_id"] or "").strip()
        if not cid:
            cid = str(uuid.uuid4())
            conn.execute(
                "UPDATE crossing_events SET client_event_id = ? WHERE id = ?",
                (cid, rid),
            )

        ts = r["ts_utc"]
        ts_out = ts if isinstance(ts, str) and "T" in ts else f"{ts}"

        conf = r["confidence"]
        events.append(
            {
                "client_event_id": cid,
                "occurred_at": ts_out,
                "direction": direction,
                "confidence": float(conf) if conf is not None else None,
            }
        )
        row_ids.append(rid)

    conn.commit()

    if not events:
        conn.close()
        print("No syncable rows")
        return

    try:
        post_sync_events(url, secret, slug, events, timeout_sec=60.0)
    except Exception as e:
        print(e, file=sys.stderr)
        conn.close()
        sys.exit(1)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    for rid in row_ids:
        conn.execute("UPDATE crossing_events SET synced_at = ? WHERE id = ?", (now, rid))
    conn.commit()
    conn.close()
    print(f"Synced {len(events)} events")


if __name__ == "__main__":
    main()
