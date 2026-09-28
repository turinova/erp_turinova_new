#!/usr/bin/env python3
"""
Hírös-Ablak accessories → modul-app accessories + accessory_suppliers.

Usage (modul-app dir):
  python3 scripts/import_hiros_accessories.py --dry-run
  python3 scripts/import_hiros_accessories.py

Decisions:
  - skip deleted + test/példa partners
  - keep UUIDs
  - manufacturer_id = null
  - partners_id → accessory_suppliers (primary)
  - base_price → purchase_price_net, multiplier → margin_factor
  - barcode_u → barcode_internal
  - duplicate barcode → null on later rows
  - tax = tenant 27% / default
  - images: manual upload later (no image_url here)
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
ACC_CSV = Path(
    os.environ.get(
        "ACCESSORIES_CSV",
        "/Volumes/T7/erp_turinova_new/modul-app/transfer/accessories_rows (1).csv",
    )
)

SKIP_PARTNER_NAME_SUBSTR = (
    "teszt",
    "test",
    "példa",
    "pelda",
    "német beszállító",
    "nemet beszallito",
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


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def alive(row: dict[str, str]) -> bool:
    return not (row.get("deleted_at") or "").strip()


def nz(v: str | None) -> str | None:
    if v is None:
        return None
    t = str(v).strip()
    return t if t else None


def num_int(v: str | None) -> int | None:
    t = nz(v)
    if t is None:
        return None
    try:
        return int(round(float(t.replace(",", "."))))
    except ValueError:
        return None


def num_float(v: str | None) -> float | None:
    t = nz(v)
    if t is None:
        return None
    try:
        return float(t.replace(",", "."))
    except ValueError:
        return None


def skip_partner(name: str) -> bool:
    n = name.strip().lower()
    return any(s in n for s in SKIP_PARTNER_NAME_SUBSTR)


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
            with urllib.request.urlopen(req, timeout=180, context=_SSL) as resp:
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
        chunk = 200
        for i in range(0, len(rows), chunk):
            slice_ = rows[i : i + chunk]
            self._req(
                "POST",
                table,
                body=slice_,
                prefer="resolution=merge-duplicates,return=minimal",
                params=f"?on_conflict={on_conflict}",
            )
            print(f"  {table}: {min(i + chunk, len(rows))}/{len(rows)}", flush=True)

    def insert(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        chunk = 500
        for i in range(0, len(rows), chunk):
            slice_ = rows[i : i + chunk]
            self._req(
                "POST",
                table,
                body=slice_,
                prefer="return=minimal",
            )
            print(f"  {table}: {min(i + chunk, len(rows))}/{len(rows)}", flush=True)

    def delete(self, table: str, query: str) -> None:
        self._req("DELETE", table, prefer="return=minimal", params=f"?{query}")


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

    partners = {
        r["id"]: r
        for r in read_csv(ATT / "partners_rows.csv")
    }
    rows = read_csv(ACC_CSV)
    sb = Sb(url, key)

    tax_rows = sb.select(
        "tax_rates",
        f"select=id,name,rate_percent,is_default&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )
    tax = next((t for t in tax_rows if t.get("is_default")), None) or next(
        (t for t in tax_rows if float(t["rate_percent"]) == 27), None
    ) or (tax_rows[0] if tax_rows else None)
    if not tax:
        print("No tax_rate", file=sys.stderr)
        return 1
    print("tax", tax["id"], tax["name"], tax["rate_percent"])

    # units must already exist with same UUIDs
    unit_ids = {
        u["id"]
        for u in sb.select(
            "units",
            f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
        )
    }
    supplier_ids = {
        s["id"]
        for s in sb.select(
            "suppliers",
            f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
        )
    }
    print("units", len(unit_ids), "suppliers", len(supplier_ids))

    accessories: list[dict] = []
    links: list[dict] = []
    skipped_deleted = 0
    skipped_test = 0
    skipped_unit = 0
    skipped_supplier = 0
    barcode_nulled = 0
    barcode_u_nulled = 0
    seen_barcodes: set[str] = set()
    seen_barcode_u: set[str] = set()

    for r in rows:
        if not alive(r):
            skipped_deleted += 1
            continue

        pid = nz(r.get("partners_id"))
        partner = partners.get(pid or "")
        pname = (partner or {}).get("name") or ""
        if (
            not partner
            or (partner.get("deleted_at") or "").strip()
            or skip_partner(pname)
        ):
            skipped_test += 1
            continue

        uid = nz(r.get("units_id"))
        if not uid or uid not in unit_ids:
            skipped_unit += 1
            continue

        if pid not in supplier_ids:
            skipped_supplier += 1
            continue

        barcode = nz(r.get("barcode"))
        if barcode:
            if barcode in seen_barcodes:
                barcode = None
                barcode_nulled += 1
            else:
                seen_barcodes.add(barcode)

        barcode_u = nz(r.get("barcode_u"))
        if barcode_u:
            if barcode_u in seen_barcode_u:
                barcode_u = None
                barcode_u_nulled += 1
            else:
                seen_barcode_u.add(barcode_u)

        price = num_int(r.get("net_price"))
        if price is None or price < 0:
            price = 0

        purchase = num_int(r.get("base_price"))
        margin = num_float(r.get("multiplier"))
        if margin is not None and (margin <= 0 or margin > 100):
            margin = None

        aid = r["id"].strip()
        accessories.append(
            {
                "id": aid,
                "tenant_id": TENANT_ID,
                "manufacturer_id": None,
                "tax_rate_id": tax["id"],
                "unit_id": uid,
                "name": (r.get("name") or "").strip() or (r.get("sku") or "").strip(),
                "sku": (r.get("sku") or "").strip(),
                "barcode": barcode,
                "barcode_internal": barcode_u,
                "price_net": price,
                "purchase_price_net": purchase,
                "margin_factor": margin,
                "active": True,
                "sellable_pos": True,
                "deleted_at": None,
            }
        )
        links.append(
            {
                "tenant_id": TENANT_ID,
                "accessory_id": aid,
                "supplier_id": pid,
                "is_primary": True,
                "sort_order": 0,
            }
        )

    print(
        "accessories",
        len(accessories),
        "links",
        len(links),
        "skipped deleted",
        skipped_deleted,
        "test/példa",
        skipped_test,
        "bad unit",
        skipped_unit,
        "missing supplier",
        skipped_supplier,
        "barcode nulled",
        barcode_nulled,
        "barcode_u nulled",
        barcode_u_nulled,
    )
    if accessories:
        print("sample", accessories[0])

    if args.dry_run:
        print("Dry-run OK")
        return 0

    sb.upsert("accessories", accessories, "id")

    # replace links for imported accessories
    ids = [a["id"] for a in accessories]
    chunk = 80
    for i in range(0, len(ids), chunk):
        part = ids[i : i + chunk]
        in_list = "(" + ",".join(part) + ")"
        sb.delete(
            "accessory_suppliers",
            f"tenant_id=eq.{TENANT_ID}&accessory_id=in.{in_list}",
        )
    sb.insert("accessory_suppliers", links)

    # verify
    alive_n = sb.select(
        "accessories",
        f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null&limit=1",
    )
    # count via Prefer header — use a small RPC-less approach
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/accessories?select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
            "Range": "0-0",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=60, context=_SSL) as resp:
        print("verify accessories content-range", resp.headers.get("content-range"))
        resp.read()

    req2 = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/accessory_suppliers?select=id&tenant_id=eq.{TENANT_ID}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
            "Range": "0-0",
        },
        method="GET",
    )
    with urllib.request.urlopen(req2, timeout=60, context=_SSL) as resp:
        print("verify links content-range", resp.headers.get("content-range"))
        resp.read()

    sample_id = accessories[0]["id"]
    sample = sb.select(
        "accessories",
        f"select=id,name,sku,price_net,purchase_price_net,margin_factor,manufacturer_id,unit_id"
        f"&id=eq.{sample_id}",
    )
    print("verify sample", sample)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
