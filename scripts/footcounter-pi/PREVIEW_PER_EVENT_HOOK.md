# Per-event sync (reference)

**Current `preview_hailo_mjpeg.py` in this repo** already calls **`schedule_crossing_sync`** after each insert. Deploy with **`DEPLOY_PER_EVENT.md`**.

If you maintain a **fork** of the preview, use **`footcounter_per_event_sync.schedule_crossing_sync`** (same directory as **`footcounter_sync_client.py`**).

---

## Legacy pattern (custom preview)

After you **INSERT** a row into `crossing_events` with a **`client_event_id`** (UUID string), fire **one** HTTP POST in a **background thread** so the camera loop never blocks. On success, set **`synced_at`**; on failure, leave **`synced_at` NULL** so `sync_to_supabase.py` (cron) retries.

## Deploy helper on the Pi

Put **`footcounter_sync_client.py`** and **`footcounter_per_event_sync.py`** next to your preview script (e.g. `/opt/footcounter/`).

## Pattern (adapt to your SQLite API) — or `from footcounter_per_event_sync import schedule_crossing_sync`

```python
import os
import sqlite3
import threading

# At top of preview module (same dir as footcounter_sync_client.py):
from footcounter_sync_client import post_sync_events

def _mark_synced(db_path: str, row_id: int) -> None:
    conn = sqlite3.connect(db_path)
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        conn.execute("UPDATE crossing_events SET synced_at = ? WHERE id = ?", (now, row_id))
        conn.commit()
    finally:
        conn.close()


def schedule_sync_crossing(
    db_path: str,
    row_id: int,
    client_event_id: str,
    occurred_at_iso: str,
    direction: str,
    confidence: float | None,
) -> None:
    url = os.environ.get("FOOTCOUNTER_SYNC_URL", "").strip()
    secret = os.environ.get("FOOTCOUNTER_SYNC_SECRET", "").strip()
    slug = os.environ.get("FOOTCOUNTER_DEVICE_SLUG", "default").strip()
    if not url or not secret:
        return

    ev = {
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
            # Leave synced_at NULL; sync_to_supabase.py will retry
            pass

    threading.Thread(target=run, daemon=True).start()
```

Call **`schedule_sync_crossing(...)`** immediately after **`commit()`** on the insert that created the row. Use the same **`FOOTCOUNTER_DB_PATH`** you use for the preview DB.

## Env

Same as batch sync: **`FOOTCOUNTER_SYNC_URL`**, **`FOOTCOUNTER_SYNC_SECRET`**, **`FOOTCOUNTER_DEVICE_SLUG`**, and **`FOOTCOUNTER_LOG_CROSSINGS=1`**.
