#!/usr/bin/env python3
"""
Hírös-Ablak partners (beszállítók) → modul-app suppliers.

Usage (modul-app dir):
  python3 scripts/import_hiros_suppliers.py --dry-run
  python3 scripts/import_hiros_suppliers.py

Decisions:
  - skip soft-deleted
  - keep partner UUIDs as supplier ids
  - skip email_template_html
  - default_tax_rate_id = tenant default / 27%
  - currency_id → HUF
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
import uuid
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

# main-app currencies.id → ISO code (Hírös export: single HUF uuid)
CURRENCY_MAP = {
    "2dc21d30-c7e8-4d3a-b57a-1e0a4870ec1b": "HUF",
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


def nz(v: str | None) -> str | None:
    if v is None:
        return None
    t = str(v).strip()
    return t if t else None


def payment_days(v: str | None) -> int:
    t = nz(v)
    if not t:
        return 30
    try:
        return max(0, min(365, int(round(float(t.replace(",", "."))))))
    except ValueError:
        return 30


def currency_code(currency_id: str | None) -> str:
    cid = nz(currency_id)
    if not cid:
        return "HUF"
    return CURRENCY_MAP.get(cid, "HUF")


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

    def insert(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        chunk = 100
        for i in range(0, len(rows), chunk):
            slice_ = rows[i : i + chunk]
            self._req(
                "POST",
                table,
                body=slice_,
                prefer="return=minimal",
            )
            print(f"  {table}: {min(i + chunk, len(rows))}/{len(rows)}")

    def delete(self, table: str, query: str) -> None:
        self._req("DELETE", table, prefer="return=minimal", params=f"?{query}")


def has_address(row: dict[str, str]) -> bool:
    return any(
        nz(row.get(k))
        for k in ("country", "postal_code", "city", "address")
    )


def build_rows(
    partners: list[dict[str, str]], tax_rate_id: str
) -> tuple[list[dict], list[dict], list[dict], int]:
    suppliers: list[dict] = []
    addresses: list[dict] = []
    contacts: list[dict] = []
    skipped = 0

    for p in partners:
        if not alive(p):
            skipped += 1
            continue

        sid = p["id"].strip()
        suppliers.append(
            {
                "id": sid,
                "tenant_id": TENANT_ID,
                "name": (p.get("name") or "").strip(),
                "email": nz(p.get("email")),
                "phone": nz(p.get("mobile")),
                "website": None,
                "tax_number": nz(p.get("tax_number")),
                "eu_vat_number": None,
                "company_reg_number": nz(p.get("company_registration_number")),
                "iban": nz(p.get("bank_account")),
                "bic": None,
                "account_holder": None,
                "notes": nz(p.get("notes")),
                "status": "active"
                if (p.get("status") or "active").strip() == "active"
                else "inactive",
                "default_currency": currency_code(p.get("currency_id")),
                "default_tax_rate_id": tax_rate_id,
                "default_payment_method_id": None,
                "default_payment_terms_days": payment_days(p.get("payment_terms")),
                "deleted_at": None,
            }
        )

        if has_address(p):
            addresses.append(
                {
                    "id": str(uuid.uuid4()),
                    "tenant_id": TENANT_ID,
                    "supplier_id": sid,
                    "label": None,
                    "address_type": "billing",
                    "country": nz(p.get("country")) or "Magyarország",
                    "postal_code": nz(p.get("postal_code")),
                    "city": nz(p.get("city")),
                    "street": nz(p.get("address")),
                    "house_number": None,
                    "is_default": True,
                }
            )

        contact = nz(p.get("contact_person"))
        if contact:
            contacts.append(
                {
                    "id": str(uuid.uuid4()),
                    "tenant_id": TENANT_ID,
                    "supplier_id": sid,
                    "name": contact,
                    "email": nz(p.get("email")),
                    "phone": nz(p.get("mobile")),
                    "is_primary": True,
                    "note": None,
                }
            )

    return suppliers, addresses, contacts, skipped


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

    partners = read_csv("partners_rows.csv")
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

    suppliers, addresses, contacts, skipped = build_rows(partners, tax["id"])
    print(
        "suppliers",
        len(suppliers),
        "addresses",
        len(addresses),
        "contacts",
        len(contacts),
        "skipped deleted",
        skipped,
    )
    if suppliers:
        print("sample", suppliers[0])

    if args.dry_run:
        print("Dry-run OK")
        return 0

    sb.upsert("suppliers", suppliers, "id")

    # Re-run safe: replace child rows for imported suppliers
    ids = [s["id"] for s in suppliers]
    # PostgREST in.() — chunk if needed
    chunk = 80
    for i in range(0, len(ids), chunk):
        part = ids[i : i + chunk]
        in_list = "(" + ",".join(part) + ")"
        sb.delete(
            "supplier_addresses",
            f"tenant_id=eq.{TENANT_ID}&supplier_id=in.{in_list}",
        )
        sb.delete(
            "supplier_contacts",
            f"tenant_id=eq.{TENANT_ID}&supplier_id=in.{in_list}",
        )
    sb.insert("supplier_addresses", addresses)
    sb.insert("supplier_contacts", contacts)

    # verify
    alive_count = sb.select(
        "suppliers",
        f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null",
    )
    sample_id = suppliers[0]["id"]
    sample = sb.select(
        "suppliers",
        f"select=id,name,phone,email,default_currency,default_tax_rate_id,"
        f"default_payment_terms_days,tax_number"
        f"&id=eq.{sample_id}",
    )
    addr_n = sb.select(
        "supplier_addresses",
        f"select=id&tenant_id=eq.{TENANT_ID}",
    )
    contact_n = sb.select(
        "supplier_contacts",
        f"select=id&tenant_id=eq.{TENANT_ID}",
    )
    print("verify alive suppliers", len(alive_count))
    print("verify sample", sample)
    print("verify addresses", len(addr_n), "contacts", len(contact_n))
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
