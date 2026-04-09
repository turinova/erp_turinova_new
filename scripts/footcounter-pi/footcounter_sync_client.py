#!/usr/bin/env python3
"""
HTTP client for main-app POST /api/footcounter/sync (Pi → Next.js → Supabase).

Use from preview_hailo_mjpeg.py after each crossing (events length 1, short timeout),
or from sync_to_supabase.py for batch catch-up (longer timeout).

Auth: Authorization: Bearer <FOOTCOUNTER_SYNC_SECRET> or header x-footcounter-secret (server accepts both).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def load_env(path: Path) -> None:
    """Load KEY=VAL lines into os.environ if key not already set."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def load_footcounter_env() -> None:
    """Standard Pi paths: /opt/footcounter/config.env and sibling of caller."""
    load_env(Path("/opt/footcounter/config.env"))
    # Script dir (works when run from /opt/footcounter)
    load_env(Path(__file__).resolve().parent / "config.env")


def post_sync_events(
    url: str,
    secret: str,
    device_slug: str,
    events: list[dict[str, Any]],
    *,
    timeout_sec: float = 30.0,
) -> None:
    """
    POST { device_slug, events }. Raises on HTTP/network error or empty/invalid payload.

    Each event dict: client_event_id (str), occurred_at (ISO str), direction ('in'|'out'), optional confidence (float|None).
    """
    if not url.strip() or not secret.strip():
        raise ValueError("url and secret required")
    if not device_slug.strip():
        raise ValueError("device_slug required")
    if not events:
        raise ValueError("events must be non-empty")
    if len(events) > 500:
        raise ValueError("max 500 events per request")

    payload = json.dumps({"device_slug": device_slug.strip(), "events": events}).encode("utf-8")
    req = urllib.request.Request(
        url.strip(),
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret.strip()}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            if resp.status >= 400:
                body = resp.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"HTTP {resp.status}: {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e
