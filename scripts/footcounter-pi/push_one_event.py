#!/usr/bin/env python3
"""
Send a single crossing to POST /api/footcounter/sync (manual test or scripting).

Uses FOOTCOUNTER_SYNC_URL, FOOTCOUNTER_SYNC_SECRET, FOOTCOUNTER_DEVICE_SLUG from config.env.

Examples:
  python3 push_one_event.py --direction in
  python3 push_one_event.py --direction out --occurred-at 2026-04-09T12:00:00Z
  echo '{"client_event_id":"...","occurred_at":"...","direction":"in"}' | python3 push_one_event.py --stdin
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone

from footcounter_sync_client import load_footcounter_env, post_sync_events


def main() -> None:
    load_footcounter_env()

    p = argparse.ArgumentParser(description="POST one footcounter event to main-app sync API")
    p.add_argument("--stdin", action="store_true", help="Read one JSON object from stdin")
    p.add_argument("--direction", choices=("in", "out"), help="Crossing direction")
    p.add_argument("--occurred-at", default="", help="ISO timestamp (default: now UTC)")
    p.add_argument("--client-event-id", default="", help="UUID (default: random)")
    p.add_argument("--confidence", type=float, default=None)
    p.add_argument("--timeout", type=float, default=15.0, help="HTTP timeout seconds")
    args = p.parse_args()

    url = os.environ.get("FOOTCOUNTER_SYNC_URL", "").strip()
    secret = os.environ.get("FOOTCOUNTER_SYNC_SECRET", "").strip()
    slug = os.environ.get("FOOTCOUNTER_DEVICE_SLUG", "default").strip()
    if not url or not secret:
        print("FOOTCOUNTER_SYNC_URL and FOOTCOUNTER_SYNC_SECRET required", file=sys.stderr)
        sys.exit(1)

    if args.stdin:
        raw = sys.stdin.read().strip()
        if not raw:
            print("stdin empty", file=sys.stderr)
            sys.exit(1)
        ev = json.loads(raw)
        if not isinstance(ev, dict):
            print("stdin must be a JSON object", file=sys.stderr)
            sys.exit(1)
        events = [ev]
    else:
        if not args.direction:
            print("--direction in|out required (or use --stdin)", file=sys.stderr)
            sys.exit(1)
        ts = args.occurred_at.strip() or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        cid = args.client_event_id.strip() or str(uuid.uuid4())
        ev: dict = {"client_event_id": cid, "occurred_at": ts, "direction": args.direction}
        if args.confidence is not None:
            ev["confidence"] = args.confidence
        events = [ev]

    for k in ("client_event_id", "occurred_at", "direction"):
        if k not in events[0] or not str(events[0][k]).strip():
            print(f"event missing {k}", file=sys.stderr)
            sys.exit(1)

    try:
        post_sync_events(url, secret, slug, events, timeout_sec=args.timeout)
    except Exception as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    print("ok", events[0].get("client_event_id"))


if __name__ == "__main__":
    main()
