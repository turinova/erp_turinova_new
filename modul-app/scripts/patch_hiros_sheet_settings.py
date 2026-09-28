#!/usr/bin/env python3
"""
Backfill sheet_materials opti fields from main-app material_settings CSV.

Usage (modul-app dir):
  python3 scripts/patch_hiros_sheet_settings.py --dry-run
  python3 scripts/patch_hiros_sheet_settings.py
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

TENANT_ID = "45dd7c02-28e9-4f4a-b74c-704f63437927"
ATT = Path(
    os.environ.get(
        "MATERIALS_CSV_DIR",
        "/Users/mezo.david/.cursor/projects/Volumes-T7-erp-turinova-new/attachments/f75851a9-864e-42e0-8145-0a5893a340c5",
    )
)

_SSL = ssl.create_default_context()
try:
    import certifi  # type: ignore

    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL.check_hostname = False
    _SSL.verify_mode = ssl.CERT_NONE


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


def alive(row: dict) -> bool:
    return not (row.get("deleted_at") or "").strip()


def num_int(v: str) -> int:
    return int(round(float(str(v).replace(",", ".").strip())))


def num_float(v: str) -> float:
    return float(str(v).replace(",", ".").strip())


def boolish(v: str) -> bool:
    return str(v).strip().lower() in ("true", "t", "1", "yes")


def patch_one(url: str, key: str, row: dict, retries: int = 4) -> None:
    rid = row["id"]
    body = {k: v for k, v in row.items() if k != "id"}
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/sheet_materials?id=eq.{rid}&tenant_id=eq.{TENANT_ID}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    last: BaseException | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60, context=_SSL):
                return
        except urllib.error.HTTPError as e:
            raise RuntimeError(
                f"{rid}: {e.read().decode('utf-8', errors='replace')}"
            ) from e
        except (TimeoutError, urllib.error.URLError, OSError) as e:
            last = e
            if attempt + 1 == retries:
                break
    raise RuntimeError(f"{rid}: {last}") from last


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    load_env(root / ".env.local")
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        print("Missing Supabase env", file=sys.stderr)
        return 1

    materials = list(
        csv.DictReader((ATT / "materials_rows.csv").open(newline="", encoding="utf-8"))
    )
    alive_ids = {m["id"] for m in materials if alive(m)}

    settings = list(
        csv.DictReader(
            (ATT / "material_settings_rows.csv").open(newline="", encoding="utf-8")
        )
    )

    patches: list[dict] = []
    skipped = 0
    for s in settings:
        mid = (s.get("material_id") or "").strip()
        if mid not in alive_ids:
            skipped += 1
            continue
        patches.append(
            {
                "id": mid,
                "kerf_mm": num_int(s["kerf_mm"]),
                "trim_top_mm": num_int(s["trim_top_mm"]),
                "trim_right_mm": num_int(s["trim_right_mm"]),
                "trim_bottom_mm": num_int(s["trim_bottom_mm"]),
                "trim_left_mm": num_int(s["trim_left_mm"]),
                "rotatable": boolish(s["rotatable"]),
                "waste_multi": num_float(s["waste_multi"]),
                "usage_limit": num_float(s["usage_limit"]),
            }
        )

    print("patches", len(patches), "skipped (deleted/other)", skipped)
    if patches:
        print("sample", patches[0])

    if args.dry_run:
        print("Dry-run OK")
        return 0

    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(patch_one, base, key, p) for p in patches]
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 100 == 0 or done == len(patches):
                print(f"  patched {done}/{len(patches)}", flush=True)

    # spot-check a few values via GET
    sample_id = patches[0]["id"]
    req = urllib.request.Request(
        f"{base.rstrip('/')}/rest/v1/sheet_materials?id=eq.{sample_id}"
        f"&select=id,kerf_mm,trim_top_mm,trim_left_mm,trim_right_mm,trim_bottom_mm,"
        f"rotatable,waste_multi,usage_limit",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30, context=_SSL) as resp:
        print("verify sample", json.loads(resp.read().decode("utf-8")))

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
