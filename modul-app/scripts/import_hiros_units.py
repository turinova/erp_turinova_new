#!/usr/bin/env python3
"""
Hírös-Ablak units → modul-app units (Törzsadatok / Rendszer / Egységek).

Usage (modul-app dir):
  python3 scripts/import_hiros_units.py --dry-run
  python3 scripts/import_hiros_units.py

Decisions: skip deleted, keep UUIDs.
Soft-deletes tenant units that collide on lower(name)/lower(shortform)
with a different id (e.g. seed Darab/db).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

_SSL = ssl.create_default_context()
try:
    import certifi  # type: ignore

    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL.check_hostname = False
    _SSL.verify_mode = ssl.CERT_NONE

TENANT_ID = "45dd7c02-28e9-4f4a-b74c-704f63437927"
ATT = Path(
    os.environ.get(
        "MATERIALS_CSV_DIR",
        "/Users/mezo.david/.cursor/projects/Volumes-T7-erp-turinova-new/attachments/f75851a9-864e-42e0-8145-0a5893a340c5",
    )
)


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def read_csv(name: str) -> list[dict[str, str]]:
    with (ATT / name).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def alive(row: dict[str, str]) -> bool:
    return not (row.get("deleted_at") or "").strip()


class Sb:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.key = key

    def _req(
        self,
        method: str,
        path: str,
        *,
        body: object | None = None,
        prefer: str | None = None,
        params: str = "",
    ) -> tuple[int, object]:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{path}{params}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120, context=_SSL) as resp:
                raw = resp.read().decode("utf-8")
                return resp.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {e.code} {path}: {err}") from e

    def select(self, table: str, query: str) -> list[dict]:
        _, data = self._req(
            "GET",
            table,
            prefer="return=representation",
            params=f"?{query}",
        )
        assert isinstance(data, list)
        return data

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if not rows:
            return
        chunk = 100
        for i in range(0, len(rows), chunk):
            slice_ = rows[i : i + chunk]
            self._req(
                "POST",
                table,
                body=slice_,
                prefer="resolution=merge-duplicates,return=minimal",
                params=f"?on_conflict={on_conflict}",
            )
            print(f"  {table}: {min(i + chunk, len(rows))}/{len(rows)}")

    def patch(self, table: str, query: str, body: dict) -> None:
        self._req(
            "PATCH",
            table,
            body=body,
            prefer="return=minimal",
            params=f"?{query}",
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    load_env(root / ".env.local")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Missing Supabase env", file=sys.stderr)
        return 1

    rows = read_csv("units_rows.csv")
    units: list[dict] = []
    skipped = 0
    for r in rows:
        if not alive(r):
            skipped += 1
            continue
        name = (r.get("name") or "").strip()
        shortform = (r.get("shortform") or "").strip()
        if not name or not shortform:
            print("skip empty name/shortform", r.get("id"), file=sys.stderr)
            skipped += 1
            continue
        units.append(
            {
                "id": r["id"].strip(),
                "tenant_id": TENANT_ID,
                "name": name,
                "shortform": shortform,
                "deleted_at": None,
            }
        )

    print("units", len(units), "skipped deleted/empty", skipped)
    if units:
        print("sample", units[0])

    sb = Sb(url, key)
    existing = sb.select(
        "units",
        f"select=id,name,shortform,deleted_at&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )
    want_ids = {u["id"] for u in units}
    want_names = {u["name"].lower() for u in units}
    want_shorts = {u["shortform"].lower() for u in units}

    collide = [
        e
        for e in existing
        if e["id"] not in want_ids
        and (
            (e.get("name") or "").lower() in want_names
            or (e.get("shortform") or "").lower() in want_shorts
        )
    ]
    print("existing alive", len(existing), "collisions to soft-delete", len(collide))
    for c in collide:
        print("  collide", c)

    if args.dry_run:
        print("Dry-run OK")
        return 0

    for c in collide:
        sb.patch(
            "units",
            f"id=eq.{c['id']}&tenant_id=eq.{TENANT_ID}",
            {"deleted_at": "now()"},
        )
        print("  soft-deleted", c["id"], c["name"], c["shortform"])

    sb.upsert("units", units, "id")

    alive_now = sb.select(
        "units",
        f"select=id,name,shortform&tenant_id=eq.{TENANT_ID}&deleted_at=is.null&order=name",
    )
    print("verify alive", len(alive_now))
    for u in alive_now:
        print(f"  {u['name']:20s} {u['shortform']:10s} {u['id']}")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
