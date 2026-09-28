#!/usr/bin/env python3
"""
Beköti a Storage-ba feltöltött anyagképek public URL-jét a DB image_url mezőjébe.

Előfeltétel: fájlok a bucketben:
  sheet-materials/{tenant_id}/<basename>
  linear-materials/{tenant_id}/<basename>

Usage (modul-app dir):
  python3 scripts/link_hiros_material_images.py --dry-run
  python3 scripts/link_hiros_material_images.py
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

TENANT_ID = "45dd7c02-28e9-4f4a-b74c-704f63437927"
ATT = Path(
    os.environ.get(
        "MATERIALS_CSV_DIR",
        "/Users/mezo.david/.cursor/projects/Volumes-T7-erp-turinova-new/attachments/f75851a9-864e-42e0-8145-0a5893a340c5",
    )
)
LOCAL_SHEET = Path(
    os.environ.get(
        "MATERIALS_SHEET_DIR",
        "/Users/mezo.david/Downloads/materials 2/sheet",
    )
)
LOCAL_LINEAR = Path(
    os.environ.get(
        "MATERIALS_LINEAR_DIR",
        "/Users/mezo.david/Downloads/materials 2/linear",
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


def basename(url: str | None) -> str | None:
    if not url or not str(url).strip():
        return None
    return url.rstrip("/").split("/")[-1].split("?")[0]


def public_url(base: str, bucket: str, filename: str) -> str:
    return (
        f"{base.rstrip('/')}/storage/v1/object/public/{bucket}/"
        f"{TENANT_ID}/{filename}"
    )


def head_ok(url: str) -> bool:
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=20, context=_SSL) as resp:
            return 200 <= resp.status < 300
    except Exception:
        # some CDNs reject HEAD — try GET range
        try:
            req = urllib.request.Request(
                url, headers={"Range": "bytes=0-0"}, method="GET"
            )
            with urllib.request.urlopen(req, timeout=20, context=_SSL) as resp:
                return resp.status in (200, 206)
        except Exception:
            return False


def patch_image_urls(url: str, key: str, table: str, rows: list[dict]) -> None:
    """PATCH image_url by primary key (avoids upsert NOT NULL on insert attempt)."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def one(row: dict) -> None:
        rid = row["id"]
        body = json.dumps({"image_url": row["image_url"]}).encode("utf-8")
        req = urllib.request.Request(
            f"{url.rstrip('/')}/rest/v1/{table}?id=eq.{rid}",
            data=body,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=_SSL):
                pass
        except urllib.error.HTTPError as e:
            raise RuntimeError(
                f"{table} {rid}: {e.read().decode('utf-8', errors='replace')}"
            ) from e

    done = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        futs = [pool.submit(one, r) for r in rows]
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 100 == 0 or done == len(rows):
                print(f"  {table}: {done}/{len(rows)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--sample-check",
        type=int,
        default=5,
        help="Hány random URL-t ellenőrizzen HEAD/GET-tel (0=skip)",
    )
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    load_env(root / ".env.local")
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        print("Missing Supabase env", file=sys.stderr)
        return 1

    sheet_files = {p.name for p in LOCAL_SHEET.iterdir() if p.is_file()} if LOCAL_SHEET.is_dir() else set()
    linear_files = {p.name for p in LOCAL_LINEAR.iterdir() if p.is_file()} if LOCAL_LINEAR.is_dir() else set()
    print("local sheet files", len(sheet_files), "linear", len(linear_files))

    sheets_csv = list(
        csv.DictReader((ATT / "materials_rows.csv").open(newline="", encoding="utf-8"))
    )
    linears_csv = list(
        csv.DictReader(
            (ATT / "linear_materials_rows-2.csv").open(newline="", encoding="utf-8")
        )
    )

    sheet_updates: list[dict] = []
    sheet_skip_missing = 0
    sheet_no_file = 0
    for r in sheets_csv:
        if not alive(r):
            continue
        name = basename(r.get("image_url"))
        if not name:
            sheet_no_file += 1
            continue
        if name not in sheet_files:
            sheet_skip_missing += 1
            continue
        sheet_updates.append(
            {
                "id": r["id"],
                "image_url": public_url(base, "sheet-materials", name),
            }
        )

    linear_updates: list[dict] = []
    linear_skip_missing = 0
    linear_no_file = 0
    for r in linears_csv:
        if not alive(r):
            continue
        name = basename(r.get("image_url"))
        if not name:
            linear_no_file += 1
            continue
        if name not in linear_files:
            linear_skip_missing += 1
            continue
        linear_updates.append(
            {
                "id": r["id"],
                "image_url": public_url(base, "linear-materials", name),
            }
        )

    print(
        "sheet updates",
        len(sheet_updates),
        "no image in CSV",
        sheet_no_file,
        "not in local folder",
        sheet_skip_missing,
    )
    print(
        "linear updates",
        len(linear_updates),
        "no image in CSV",
        linear_no_file,
        "not in local folder",
        linear_skip_missing,
    )
    if sheet_updates:
        print("sample sheet URL", sheet_updates[0]["image_url"])
    if linear_updates:
        print("sample linear URL", linear_updates[0]["image_url"])

    if args.sample_check > 0:
        import random

        samples = []
        if sheet_updates:
            samples += random.sample(
                sheet_updates, min(args.sample_check, len(sheet_updates))
            )
        if linear_updates:
            samples += random.sample(
                linear_updates, min(args.sample_check, len(linear_updates))
            )
        ok = 0
        for s in samples:
            good = head_ok(s["image_url"])
            ok += int(good)
            print("  check", "OK" if good else "MISSING", s["image_url"][-80:])
        print(f"sample checks {ok}/{len(samples)} reachable")
        if ok == 0 and samples:
            print(
                "WARNING: egyik minta URL sem elérhető — a feltöltés path/bucket lehet rossz.",
                file=sys.stderr,
            )
            if args.dry_run:
                return 1

    if args.dry_run:
        print("Dry-run OK")
        return 0

    print("patch sheet_materials image_url…")
    patch_image_urls(base, key, "sheet_materials", sheet_updates)
    print("patch linear_materials image_url…")
    patch_image_urls(base, key, "linear_materials", linear_updates)

    # verify counts with image_url set
    for table in ("sheet_materials", "linear_materials"):
        req = urllib.request.Request(
            f"{base.rstrip('/')}/rest/v1/{table}?select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null&image_url=not.is.null",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Prefer": "count=exact",
                "Range": "0-0",
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=60, context=_SSL) as resp:
            print(f"count {table} with image_url:", resp.headers.get("content-range"))

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
