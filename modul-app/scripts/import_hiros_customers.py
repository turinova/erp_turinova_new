#!/usr/bin/env python3
"""
Hírös-Ablak customers → modul-app customers (UUID megőrzés).

Usage (modul-app dir):
  python3 scripts/import_hiros_customers.py --dry-run
  python3 scripts/import_hiros_customers.py

Döntések:
  - tenant = Hírös (ugyanaz, mint materials/suppliers import)
  - soft-deleted kihagyva
  - „Név - online” / „Név - online (N)” kihagyva (partner portal hack; modulban portal link)
  - név-duplikátum (casefold + trim): 1 nyertes quotes aktivitás alapján
    open > quote_count > finished > gross > last_quote > favorite > contact richness
  - üres mezők a vesztesekből feltöltve (email/mobil/számla)
  - discount_percent / is_favorite → modulban nincs oszlop (kihagyva, favorite csak score)
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

_SSL = ssl.create_default_context()
try:
    import certifi  # type: ignore

    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL.check_hostname = False
    _SSL.verify_mode = ssl.CERT_NONE

TENANT_ID = "45dd7c02-28e9-4f4a-b74c-704f63437927"
DEFAULT_CSV_DIR = Path("/Users/mezo.david/Downloads/quotes")
ONLINE_RE = re.compile(r"\s-\s+online(\s+\(\d+\))?$", re.I)
OPEN_STATUSES = frozenset({"draft", "ordered", "in_production", "ready"})
CONTACT_FIELDS = (
    "email",
    "mobile",
    "billing_name",
    "billing_country",
    "billing_city",
    "billing_postal_code",
    "billing_street",
    "billing_house_number",
    "billing_tax_number",
    "billing_company_reg_number",
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


def csv_dir() -> Path:
    return Path(os.environ.get("CUSTOMERS_CSV_DIR", str(DEFAULT_CSV_DIR)))


def read_csv(name: str) -> list[dict[str, str]]:
    path = csv_dir() / name
    if not path.is_file():
        # Supabase UI néha „ (1)”-et rak a fájlnévre
        alt = csv_dir() / name.replace(".csv", " (1).csv")
        if alt.is_file():
            path = alt
        else:
            raise FileNotFoundError(path)
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def alive(row: dict[str, str]) -> bool:
    return not (row.get("deleted_at") or "").strip()


def nz(v: str | None) -> str | None:
    if v is None:
        return None
    t = str(v).strip()
    return t if t else None


def is_online_name(name: str) -> bool:
    return bool(ONLINE_RE.search(name.strip()))


def name_key(name: str) -> str:
    return name.strip().casefold()


def truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in {"true", "1", "t", "yes"}


def as_float(v: str | None) -> float:
    t = (v or "").strip().replace(",", ".")
    if not t:
        return 0.0
    try:
        return float(t)
    except ValueError:
        return 0.0


def contact_score(row: dict[str, str]) -> int:
    n = 0
    for k in CONTACT_FIELDS:
        if nz(row.get(k)):
            n += 1
    return n


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


def quote_stats(
    quotes: list[dict[str, str]],
) -> dict[str, dict[str, float | int | str]]:
    out: dict[str, dict[str, float | int | str]] = {}
    for q in quotes:
        if not alive(q):
            continue
        cid = (q.get("customer_id") or "").strip()
        if not cid:
            continue
        st = out.setdefault(
            cid,
            {
                "count": 0,
                "open": 0,
                "finished": 0,
                "gross": 0.0,
                "last": "",
            },
        )
        st["count"] = int(st["count"]) + 1
        status = (q.get("status") or "").strip()
        if status in OPEN_STATUSES:
            st["open"] = int(st["open"]) + 1
        if status == "finished":
            st["finished"] = int(st["finished"]) + 1
        st["gross"] = float(st["gross"]) + as_float(
            q.get("final_total_after_discount") or q.get("total_gross")
        )
        stamp = (q.get("updated_at") or q.get("created_at") or "").strip()
        if stamp > str(st["last"]):
            st["last"] = stamp
    return out


def rank_tuple(
    row: dict[str, str], stats: dict[str, dict[str, float | int | str]]
) -> tuple:
    cid = row["id"].strip()
    s = stats.get(
        cid, {"count": 0, "open": 0, "finished": 0, "gross": 0.0, "last": ""}
    )
    return (
        int(s["open"]),
        int(s["count"]),
        int(s["finished"]),
        float(s["gross"]),
        str(s["last"]),
        1 if truthy(row.get("is_favorite")) else 0,
        contact_score(row),
        (row.get("updated_at") or row.get("created_at") or ""),
        cid,  # stabil tie-break
    )


def merge_contact(winner: dict[str, str], losers: list[dict[str, str]]) -> dict[str, str]:
    merged = dict(winner)
    for field in CONTACT_FIELDS:
        if nz(merged.get(field)):
            continue
        for loser in losers:
            val = nz(loser.get(field))
            if val:
                merged[field] = val
                break
    # sms: true ha bármelyik true
    if any(truthy(r.get("sms_notification")) for r in [winner, *losers]):
        merged["sms_notification"] = "true"
    return merged


def pick_customers(
    customers: list[dict[str, str]],
    stats: dict[str, dict[str, float | int | str]],
) -> tuple[list[dict[str, str]], list[dict[str, str]], dict[str, str]]:
    """
    Returns: (to_import, skipped_rows_meta, loser_id → winner_id)
    """
    skipped_online = 0
    skipped_deleted = 0
    by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    skip_log: list[dict[str, str]] = []

    for c in customers:
        name = (c.get("name") or "").strip()
        if not alive(c):
            skipped_deleted += 1
            skip_log.append(
                {"id": c.get("id", ""), "name": name, "reason": "deleted"}
            )
            continue
        if not name:
            skip_log.append(
                {"id": c.get("id", ""), "name": "", "reason": "empty_name"}
            )
            continue
        if is_online_name(name):
            skipped_online += 1
            skip_log.append(
                {"id": c.get("id", ""), "name": name, "reason": "online_suffix"}
            )
            continue
        by_name[name_key(name)].append(c)

    mapping: dict[str, str] = {}
    winners: list[dict[str, str]] = []
    dedupe_groups = 0

    for _key, group in by_name.items():
        if len(group) == 1:
            winners.append(group[0])
            continue
        dedupe_groups += 1
        ranked = sorted(group, key=lambda r: rank_tuple(r, stats), reverse=True)
        winner = ranked[0]
        losers = ranked[1:]
        merged = merge_contact(winner, losers)
        winners.append(merged)
        w_stats = stats.get(winner["id"], {})
        for loser in losers:
            mapping[loser["id"].strip()] = winner["id"].strip()
            skip_log.append(
                {
                    "id": loser.get("id", ""),
                    "name": (loser.get("name") or "").strip(),
                    "reason": "dedupe_loser",
                    "winner_id": winner["id"],
                    "winner_name": (winner.get("name") or "").strip(),
                    "loser_quotes": str(
                        int(stats.get(loser["id"], {}).get("count", 0))
                    ),
                    "winner_quotes": str(int(w_stats.get("count", 0))),
                    "winner_open": str(int(w_stats.get("open", 0))),
                }
            )

    print(
        f"alive candidates grouped: {sum(len(g) for g in by_name.values())} "
        f"| dedupe groups: {dedupe_groups} "
        f"| winners: {len(winners)} "
        f"| skip online: {skipped_online} "
        f"| skip deleted: {skipped_deleted}"
    )
    return winners, skip_log, mapping


def to_row(c: dict[str, str]) -> dict:
    name = (c.get("name") or "").strip()
    country = nz(c.get("billing_country")) or "Magyarország"
    return {
        "id": c["id"].strip(),
        "tenant_id": TENANT_ID,
        "partner_profile_id": None,
        "name": name,
        "email": nz(c.get("email")),
        "mobile": nz(c.get("mobile")),
        "sms_notification": truthy(c.get("sms_notification")),
        "billing_name": nz(c.get("billing_name")),
        "billing_country": country,
        "billing_city": nz(c.get("billing_city")),
        "billing_postal_code": nz(c.get("billing_postal_code")),
        "billing_street": nz(c.get("billing_street")),
        "billing_house_number": nz(c.get("billing_house_number")),
        "billing_tax_number": nz(c.get("billing_tax_number")),
        "billing_company_reg_number": nz(c.get("billing_company_reg_number")),
        "deleted_at": None,
    }


def write_report(
    out_dir: Path,
    skip_log: list[dict[str, str]],
    mapping: dict[str, str],
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    skip_path = out_dir / "hiros_customers_skip_log.csv"
    map_path = out_dir / "hiros_customers_dedupe_map.csv"
    if skip_log:
        fields = sorted({k for row in skip_log for k in row.keys()})
        with skip_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(skip_log)
        print("skip log →", skip_path)
    with map_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["loser_id", "winner_id"])
        w.writeheader()
        for loser, winner in sorted(mapping.items()):
            w.writerow({"loser_id": loser, "winner_id": winner})
    print("dedupe map →", map_path, f"({len(mapping)} losers)")


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

    print("CSV dir", csv_dir())
    print("DRY-RUN" if args.dry_run else "LIVE", "tenant", TENANT_ID)

    customers = read_csv("customers_rows.csv")
    quotes = read_csv("quotes_rows.csv")
    stats = quote_stats(quotes)
    winners, skip_log, mapping = pick_customers(customers, stats)

    rows = [to_row(c) for c in winners]
    # végső biztonság: lower(name) unique a batchben
    seen_names: dict[str, str] = {}
    unique_rows: list[dict] = []
    for r in rows:
        k = r["name"].casefold()
        if k in seen_names:
            print(
                "WARN extra name collision after merge:",
                r["name"],
                r["id"],
                "vs",
                seen_names[k],
            )
            mapping[r["id"]] = seen_names[k]
            continue
        seen_names[k] = r["id"]
        unique_rows.append(r)

    print("to upsert (pre-existing check)", len(unique_rows))
    if unique_rows:
        print("sample", unique_rows[0])

    sb = Sb(url, key)
    # PostgREST default max 1000 — lapozva
    existing: list[dict] = []
    page = 0
    page_size = 1000
    while True:
        chunk = sb.select(
            "customers",
            f"select=id,name&tenant_id=eq.{TENANT_ID}&deleted_at=is.null"
            f"&order=id&offset={page * page_size}&limit={page_size}",
        )
        existing.extend(chunk)
        if len(chunk) < page_size:
            break
        page += 1
    print("existing alive in tenant:", len(existing))

    by_id = {str(r["id"]): str(r["name"]) for r in existing}
    by_name: dict[str, str] = {}
    for r in existing:
        by_name[str(r["name"]).strip().casefold()] = str(r["id"])

    to_upsert: list[dict] = []
    name_conflict = 0
    for r in unique_rows:
        rid = r["id"]
        nkey = r["name"].casefold()
        owner = by_name.get(nkey)
        if rid in by_id:
            # ugyanaz az id — frissítjük (név változhat; ha más névre ütközne, alább)
            if owner and owner != rid:
                # a cél név már másik id-é — ne írjuk felül a nevet, csak kontaktot?
                # biztonság: skip + map az ownerre
                mapping[rid] = owner
                skip_log.append(
                    {
                        "id": rid,
                        "name": r["name"],
                        "reason": "name_owned_by_other_existing",
                        "winner_id": owner,
                    }
                )
                name_conflict += 1
                continue
            to_upsert.append(r)
            continue
        if owner and owner != rid:
            mapping[rid] = owner
            skip_log.append(
                {
                    "id": rid,
                    "name": r["name"],
                    "reason": "name_exists_other_uuid",
                    "winner_id": owner,
                }
            )
            name_conflict += 1
            continue
        to_upsert.append(r)
        by_name[nkey] = rid  # batchen belüli foglalás

    print(
        "will upsert",
        len(to_upsert),
        "| name conflicts → map to existing",
        name_conflict,
    )
    if mapping:
        print("id remaps (dedupe + name conflict):", len(mapping))

    report_dir = root / "scripts" / "import-reports"
    write_report(report_dir, skip_log, mapping)

    if args.dry_run:
        print("Dry-run OK")
        return 0

    if to_upsert:
        sb.upsert("customers", to_upsert, "id")

    all_ids = []
    page = 0
    while True:
        chunk = sb.select(
            "customers",
            f"select=id&tenant_id=eq.{TENANT_ID}&deleted_at=is.null"
            f"&order=id&offset={page * page_size}&limit={page_size}",
        )
        all_ids.extend(chunk)
        if len(chunk) < page_size:
            break
        page += 1
    print("tenant alive customers now:", len(all_ids))
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
