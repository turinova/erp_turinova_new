#!/usr/bin/env python3
"""
Hírös fee_types + payment_methods + production_machines → modul-app (UUID megőrzés).

Usage (modul-app dir):
  python3 scripts/import_hiros_fee_payment_machines.py --dry-run
  python3 scripts/import_hiros_fee_payment_machines.py

Döntések:
  - tenant = Hírös (45dd7c02-…)
  - soft-deleted kihagyva
  - fee_types.price_net: main decimal → round() integer (modul numeric(12,0))
  - fee_types.unit_id = tenant „db” egység
  - fee_types.tax_rate_id = tenant default / 27%
  - production_machines: machine_name → name (trim)
  - name collision (más UUID): skip + log
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
CSV_CANDIDATES = [
    Path(
        "/Users/mezo.david/.cursor/projects/Volumes-T7-erp-turinova-new/"
        "attachments/f75851a9-864e-42e0-8145-0a5893a340c5"
    ),
    Path("/Users/mezo.david/Downloads/quotes"),
]


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


def find_csv(name: str) -> Path:
    env = os.environ.get("HIROS_TORZS_CSV_DIR", "").strip()
    dirs = [Path(env)] if env else []
    dirs.extend(CSV_CANDIDATES)
    alts = [name, name.replace(".csv", " (1).csv"), name.replace(".csv", "_1.csv")]
    # production_machines_rows.csv vs production_machines_rows_1.csv
    if name == "production_machines_rows.csv":
        alts.extend(
            [
                "production_machines_rows_1.csv",
                "production_machines_rows (1).csv",
            ]
        )
    if name == "feetypes_rows.csv":
        alts.append("fee_types_rows.csv")
    for d in dirs:
        if not d or not d.is_dir():
            continue
        for alt in alts:
            p = d / alt
            if p.is_file():
                return p
    raise FileNotFoundError(f"{name} not found in {dirs}")


def read_csv(name: str) -> list[dict[str, str]]:
    path = find_csv(name)
    print(f"  CSV {name} ← {path}")
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def alive(row: dict[str, str]) -> bool:
    return not (row.get("deleted_at") or "").strip()


def nz(v: str | None) -> str | None:
    if v is None:
        return None
    t = str(v).strip()
    return t if t else None


def truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in {"true", "1", "t", "yes"}


def round_net(v: str | None) -> int:
    t = (v or "").strip().replace(",", ".")
    if not t:
        return 0
    try:
        return max(0, int(round(float(t))))
    except ValueError:
        return 0


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
            print(f"  {table}: 0")
            return
        chunk = 80
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


def filter_name_conflicts(
    table: str,
    rows: list[dict],
    existing: list[dict],
    name_field: str = "name",
) -> tuple[list[dict], list[dict]]:
    by_id = {str(r["id"]): str(r[name_field]) for r in existing}
    by_name = {
        str(r[name_field]).strip().casefold(): str(r["id"]) for r in existing
    }
    ok: list[dict] = []
    skipped: list[dict] = []
    reserved: dict[str, str] = dict(by_name)

    for r in rows:
        rid = r["id"]
        nkey = str(r[name_field]).strip().casefold()
        owner = reserved.get(nkey)
        if rid in by_id:
            if owner and owner != rid:
                skipped.append(
                    {
                        "table": table,
                        "id": rid,
                        "name": r[name_field],
                        "reason": "name_owned_by_other",
                        "owner_id": owner,
                    }
                )
                continue
            ok.append(r)
            reserved[nkey] = rid
            continue
        if owner and owner != rid:
            skipped.append(
                {
                    "table": table,
                    "id": rid,
                    "name": r[name_field],
                    "reason": "name_exists_other_uuid",
                    "owner_id": owner,
                }
            )
            continue
        ok.append(r)
        reserved[nkey] = rid
    return ok, skipped


def build_fees(
    raw: list[dict[str, str]], tax_rate_id: str, unit_id: str
) -> tuple[list[dict], int, list[tuple[str, float, int]]]:
    rows: list[dict] = []
    skipped = 0
    rounds: list[tuple[str, float, int]] = []
    for c in raw:
        if not alive(c):
            skipped += 1
            continue
        name = (c.get("name") or "").strip()
        if not name:
            skipped += 1
            continue
        raw_net = (c.get("net_price") or "").strip().replace(",", ".")
        try:
            orig = float(raw_net) if raw_net else 0.0
        except ValueError:
            orig = 0.0
        price = round_net(c.get("net_price"))
        if abs(orig - price) > 0.001:
            rounds.append((name, orig, price))
        rows.append(
            {
                "id": c["id"].strip(),
                "tenant_id": TENANT_ID,
                "tax_rate_id": tax_rate_id,
                "unit_id": unit_id,
                "name": name,
                "price_net": price,
                "active": True,
                "deleted_at": None,
            }
        )
    return rows, skipped, rounds


def build_payments(raw: list[dict[str, str]]) -> tuple[list[dict], int]:
    rows: list[dict] = []
    skipped = 0
    for c in raw:
        if not alive(c):
            skipped += 1
            continue
        name = (c.get("name") or "").strip()
        if not name:
            skipped += 1
            continue
        rows.append(
            {
                "id": c["id"].strip(),
                "tenant_id": TENANT_ID,
                "name": name[:50],
                "comment": nz(c.get("comment")),
                "active": truthy(c.get("active"))
                if (c.get("active") or "").strip()
                else True,
                "deleted_at": None,
            }
        )
    return rows, skipped


def build_machines(raw: list[dict[str, str]]) -> tuple[list[dict], int]:
    rows: list[dict] = []
    skipped = 0
    for c in raw:
        if not alive(c):
            skipped += 1
            continue
        name = (c.get("machine_name") or c.get("name") or "").strip()
        if not name:
            skipped += 1
            continue
        limit_raw = (c.get("usage_limit_per_day") or "").strip()
        try:
            limit = int(round(float(limit_raw))) if limit_raw else 100
        except ValueError:
            limit = 100
        if limit <= 0:
            limit = 100
        rows.append(
            {
                "id": c["id"].strip(),
                "tenant_id": TENANT_ID,
                "name": name[:100],
                "comment": nz(c.get("comment")),
                "usage_limit_per_day": limit,
                "active": True,
                "deleted_at": None,
            }
        )
    return rows, skipped


def write_skip_log(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("table,id,name,reason,owner_id\n", encoding="utf-8")
        return
    fields = sorted({k for r in rows for k in r})
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


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

    print("DRY-RUN" if args.dry_run else "LIVE", "tenant", TENANT_ID)
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
    print("tax", tax["id"], tax.get("name"), tax.get("rate_percent"))

    units = sb.select(
        "units",
        f"select=id,name,shortform&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )
    unit = next(
        (u for u in units if str(u.get("shortform", "")).lower() == "db"), None
    ) or (units[0] if units else None)
    if not unit:
        print("No unit (db)", file=sys.stderr)
        return 1
    print("unit", unit["id"], unit.get("shortform"))

    fees_raw = read_csv("feetypes_rows.csv")
    pays_raw = read_csv("payment_methods_rows.csv")
    mach_raw = read_csv("production_machines_rows.csv")

    fees, fee_skip, rounds = build_fees(fees_raw, tax["id"], unit["id"])
    pays, pay_skip = build_payments(pays_raw)
    machs, mach_skip = build_machines(mach_raw)

    print(
        f"built fees={len(fees)} (skip {fee_skip}) "
        f"payments={len(pays)} (skip {pay_skip}) "
        f"machines={len(machs)} (skip {mach_skip})"
    )
    if rounds:
        print("price_net rounded (orig → int):")
        for name, orig, price in rounds[:20]:
            print(f"  {name}: {orig} → {price}")
        if len(rounds) > 20:
            print(f"  … +{len(rounds) - 20} more")

    existing_fees = sb.select(
        "fee_types",
        f"select=id,name&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )
    existing_pays = sb.select(
        "payment_methods",
        f"select=id,name&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )
    existing_machs = sb.select(
        "production_machines",
        f"select=id,name&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )

    fees_ok, skip1 = filter_name_conflicts("fee_types", fees, existing_fees)
    pays_ok, skip2 = filter_name_conflicts(
        "payment_methods", pays, existing_pays
    )
    machs_ok, skip3 = filter_name_conflicts(
        "production_machines", machs, existing_machs
    )
    skip_log = skip1 + skip2 + skip3
    print(
        f"upsert fees={len(fees_ok)} payments={len(pays_ok)} "
        f"machines={len(machs_ok)} | name conflicts={len(skip_log)}"
    )
    if fees_ok:
        print("sample fee", fees_ok[0])
    if pays_ok:
        print("sample payment", pays_ok[0])
    if machs_ok:
        print("sample machine", machs_ok[0])

    report = root / "scripts" / "import-reports" / "hiros_fee_payment_machines_skip.csv"
    write_skip_log(report, skip_log)
    print("skip log →", report)

    if args.dry_run:
        print("Dry-run OK")
        return 0

    sb.upsert("fee_types", fees_ok, "id")
    sb.upsert("payment_methods", pays_ok, "id")
    sb.upsert("production_machines", machs_ok, "id")

    for table, label in (
        ("fee_types", "fee_types"),
        ("payment_methods", "payment_methods"),
        ("production_machines", "production_machines"),
    ):
        n = len(
            sb.select(
                table,
                f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
            )
        )
        print(f"tenant alive {label}:", n)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
