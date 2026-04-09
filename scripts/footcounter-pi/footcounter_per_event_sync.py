#!/usr/bin/env python3
"""
Background POST of one crossing to main-app /api/footcounter/sync.

Used by preview_hailo_mjpeg.py after each SQLite insert. Requires footcounter_sync_client.py
in the same directory (e.g. /opt/footcounter/).
"""
from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Optional

from footcounter_sync_client import post_sync_events


def _mark_synced(db_path: str, row_id: int) -> None:
    conn = sqlite3.connect(db_path)
    try:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        conn.execute("UPDATE crossing_events SET synced_at = ? WHERE id = ?", (now, row_id))
        conn.commit()
    finally:
        conn.close()


def schedule_crossing_sync(
    db_path: str,
    row_id: int,
    client_event_id: str,
    occurred_at_iso: str,
    direction: str,
    confidence: Optional[float],
) -> None:
    """Fire-and-forget thread: POST one event; on success set synced_at."""
    url = os.environ.get("FOOTCOUNTER_SYNC_URL", "").strip()
    secret = os.environ.get("FOOTCOUNTER_SYNC_SECRET", "").strip()
    slug = os.environ.get("FOOTCOUNTER_DEVICE_SLUG", "default").strip()
    if not url or not secret:
        return

    ev: dict = {
        "client_event_id": client_event_id,
        "occurred_at": occurred_at_iso,
        "direction": direction.lower(),
    }
    if confidence is not None:
        ev["confidence"] = float(confidence)

    def run() -> None:
        try:
            post_sync_events(url, secret, slug, [ev], timeout_sec=10.0)
            _mark_synced(db_path, row_id)
        except Exception:
            pass

    threading.Thread(target=run, daemon=True).start()
