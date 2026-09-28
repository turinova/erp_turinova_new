#!/usr/bin/env python3
"""
Hírös-Ablak Kft. anyagok: main-app CSV → modul-app.

Usage (modul-app dir):
  python3 scripts/import_hiros_materials.py --dry-run
  python3 scripts/import_hiros_materials.py

Reads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
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

# macOS Python.org install often lacks certs; one-shot import against Supabase.
_SSL = ssl.create_default_context()
try:
    import certifi  # type: ignore

    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL.check_hostname = False
    _SSL.verify_mode = ssl.CERT_NONE

TENANT_ID = "45dd7c02-28e9-4f4a-b74c-704f63437927"
EQUIPMENT_ID = "e84e2b62-8e5e-4751-afb9-410c7b486f8c"
ATT = Path(
    os.environ.get(
        "MATERIALS_CSV_DIR",
        "/Users/mezo.david/.cursor/projects/Volumes-T7-erp-turinova-new/attachments/f75851a9-864e-42e0-8145-0a5893a340c5",
    )
)
LINEAR_TYPE = {
    "Munkalap": "munkalap",
    "Asztallap": "asztalap",
    "Hátfal": "hatfal",
    "hátfal": "hatfal",
}


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


def num(v: str | None) -> float | None:
    if v is None or not str(v).strip():
        return None
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def round0(v: str | None) -> int | None:
    n = num(v)
    return None if n is None else int(round(n))


def edge_fallback(e: dict[str, str]) -> str:
    decor = (e.get("decor") or "x").replace(" ", "-")[:40]
    return f"ELZ-{decor}-{e.get('width')}-{e.get('thickness')}"


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
        chunk = 150
        for i in range(0, len(rows), chunk):
            slice_ = rows[i : i + chunk]
            self._req(
                "POST",
                table,
                body=slice_,
                prefer=f"resolution=merge-duplicates,return=minimal",
                params=f"?on_conflict={on_conflict}",
            )
            print(f"  {table}: {min(i + chunk, len(rows))}/{len(rows)}")


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

    sb = Sb(url, key)
    print("DRY-RUN" if args.dry_run else "LIVE", "tenant", TENANT_ID)

    brands = read_csv("brands_rows.csv")
    materials = read_csv("materials_rows.csv")
    edges = read_csv("edge_materials_rows-2.csv")
    linears = read_csv("linear_materials_rows-2.csv")
    sheet_map = {r["material_id"]: (r.get("machine_code") or "").strip() for r in read_csv("machine_material_map_rows.csv")}
    edge_map = {
        r["edge_material_id"]: (r.get("machine_code") or "").strip()
        for r in read_csv("machine_edge_material_map_rows.csv")
    }

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

    eq = sb.select(
        "equipment",
        f"select=id,name,export_format&id=eq.{EQUIPMENT_ID}&tenant_id=eq.{TENANT_ID}",
    )
    if not eq:
        print("Korpus equipment missing", file=sys.stderr)
        return 1
    print("equipment", eq[0]["name"], eq[0]["export_format"])

    used_brands: set[str] = set()
    for m in materials:
        if alive(m):
            used_brands.add(m["brand_id"])
    for e in edges:
        if alive(e) and e.get("type") != "Falcolás":
            used_brands.add(e["brand_id"])
    for l in linears:
        if alive(l):
            used_brands.add(l["brand_id"])

    manufacturers = [
        {
            "id": b["id"],
            "tenant_id": TENANT_ID,
            "name": b["name"].strip(),
            "created_at": b.get("created_at") or None,
            "updated_at": b.get("updated_at") or None,
            "deleted_at": None,
        }
        for b in brands
        if alive(b) and b["id"] in used_brands
    ]

    sheets: list[dict] = []
    sheet_problems: list[str] = []
    for m in materials:
        if not alive(m):
            continue
        code = sheet_map.get(m["id"], "")
        if not code:
            sheet_problems.append(f"no code {m['id']} {m['name']}")
            continue
        length = int(round(num(m["length_mm"]) or 0))
        width = int(round(num(m["width_mm"]) or 0))
        thickness = num(m["thickness_mm"])
        price = round0(m.get("price_per_sqm"))
        if not length or not width or not thickness or price is None:
            sheet_problems.append(f"bad {m['id']}")
            continue
        sheets.append(
            {
                "id": m["id"],
                "tenant_id": TENANT_ID,
                "manufacturer_id": m["brand_id"],
                "tax_rate_id": tax["id"],
                "equipment_id": EQUIPMENT_ID,
                "name": m["name"].strip(),
                "length_mm": length,
                "width_mm": width,
                "thickness_mm": thickness,
                "on_stock": m.get("on_stock") == "true",
                "active": m.get("active") != "false",
                "image_url": None,
                "trim_top_mm": 0,
                "trim_right_mm": 0,
                "trim_bottom_mm": 0,
                "trim_left_mm": 0,
                "kerf_mm": 3,
                "waste_multi": 1.2,
                "usage_limit": 0.65,
                "grain_direction": m.get("grain_direction") == "true",
                "rotatable": True,
                "price_net": price,
                "machine_code": code[:80],
                "purchase_price_net": round0(m.get("base_price")),
                "margin_factor": num(m.get("multiplier")),
                "created_at": m.get("created_at") or None,
                "updated_at": m.get("updated_at") or None,
                "deleted_at": None,
            }
        )

    edge_rows: list[dict] = []
    edge_fallback_n = 0
    for e in edges:
        if not alive(e) or e.get("type") == "Falcolás":
            continue
        code = edge_map.get(e["id"], "")
        if not code:
            code = edge_fallback(e)
            edge_fallback_n += 1
        width = num(e.get("width"))
        thickness = num(e.get("thickness"))
        price = round0(e.get("price"))
        if not width or not thickness or price is None:
            continue
        fav = num(e.get("favourite_priority"))
        edge_rows.append(
            {
                "id": e["id"],
                "tenant_id": TENANT_ID,
                "manufacturer_id": e["brand_id"],
                "tax_rate_id": tax["id"],
                "equipment_id": EQUIPMENT_ID,
                "type": e["type"].strip(),
                "decor": (e.get("decor") or "").strip() or "-",
                "width_mm": width,
                "thickness_mm": thickness,
                "price_net": price,
                "allowance_mm": int(round(num(e.get("ráhagyás")) or 0)),
                "favourite_priority": int(round(fav)) if fav is not None else None,
                "active": e.get("active") != "false",
                "machine_code": code[:80],
                "created_at": e.get("created_at") or None,
                "updated_at": e.get("updated_at") or None,
                "deleted_at": None,
            }
        )

    linear_rows: list[dict] = []
    type_dist: dict[str, int] = {}
    for l in linears:
        if not alive(l):
            continue
        mt = LINEAR_TYPE.get(l.get("type") or "")
        if not mt:
            continue
        length = int(round(num(l.get("length")) or 0))
        width = int(round(num(l.get("width")) or 0))
        thickness = num(l.get("thickness"))
        price = round0(l.get("price_per_m"))
        if not length or not width or not thickness or price is None:
            continue
        type_dist[mt] = type_dist.get(mt, 0) + 1
        linear_rows.append(
            {
                "id": l["id"],
                "tenant_id": TENANT_ID,
                "manufacturer_id": l["brand_id"],
                "tax_rate_id": tax["id"],
                "name": l["name"].strip(),
                "material_type": mt,
                "length_mm": length,
                "width_mm": width,
                "thickness_mm": thickness,
                "on_stock": l.get("on_stock") == "true",
                "active": l.get("active") != "false",
                "image_url": None,
                "price_net": price,
                "purchase_price_net": round0(l.get("base_price")),
                "margin_factor": num(l.get("multiplier")),
                "created_at": l.get("created_at") or None,
                "updated_at": l.get("updated_at") or None,
                "deleted_at": None,
            }
        )

    print("manufacturers", len(manufacturers))
    print("sheets", len(sheets), "problems", len(sheet_problems), sheet_problems[:3])
    print("edges", len(edge_rows), "fallback", edge_fallback_n)
    print("linears", len(linear_rows), type_dist)

    if args.dry_run:
        print("Dry-run OK")
        return 0

    # Keep nulls so every row in a batch has the same keys (PostgREST PGRST102).
    # Only drop empty optional timestamps so DB default can apply.
    def clean(rows: list[dict]) -> list[dict]:
        out = []
        for r in rows:
            d = dict(r)
            for ts in ("created_at", "updated_at"):
                if d.get(ts) is None:
                    d.pop(ts, None)
            out.append(d)
        # Re-align keys: union of all keys, fill missing with None
        keys: list[str] = []
        seen: set[str] = set()
        for d in out:
            for k in d:
                if k not in seen:
                    seen.add(k)
                    keys.append(k)
        aligned = []
        for d in out:
            aligned.append({k: d.get(k) for k in keys})
        return aligned

    print("upsert manufacturers…")
    sb.upsert("manufacturers", clean(manufacturers), "id")
    print("upsert sheet_materials…")
    sb.upsert("sheet_materials", clean(sheets), "id")
    print("upsert edge_materials…")
    sb.upsert("edge_materials", clean(edge_rows), "id")
    print("upsert linear_materials…")
    sb.upsert("linear_materials", clean(linear_rows), "id")

    for table in ("manufacturers", "sheet_materials", "edge_materials", "linear_materials"):
        rows = sb.select(
            table,
            f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
        )
        # Prefer count header; fallback to len (may be capped)
        print(f"DB {table} returned {len(rows)} (page; check UI for full)")

    # exact counts via Prefer count
    for table in ("manufacturers", "sheet_materials", "edge_materials", "linear_materials"):
        req = urllib.request.Request(
            f"{url.rstrip('/')}/rest/v1/{table}?select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Prefer": "count=exact",
                "Range": "0-0",
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=60, context=_SSL) as resp:
            cr = resp.headers.get("content-range", "")
            print(f"count {table}: {cr}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
