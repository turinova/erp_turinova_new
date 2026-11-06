#!/usr/bin/env python3
"""Shoprenter XLSX + accessories CSV → image manifest, path-map, import Excel, reports.

Match key: XLSX „Gyártói cikkszám” == accessories.sku
Gallery split: |||
Import Galeria join: \" | \"
Only fills empty image_url / empty web_gallery (no overwrite).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

import openpyxl

DEFAULT_CSV = Path("/Volumes/T7/erp_turinova_new/modul-app/transfer/accessories_rows-2.csv")
DEFAULT_XLSX = Path(
    "/Users/mezo.david/Downloads/vasalatmester-xlsx-export-2026-10-08_08_56_45.xlsx"
)
DEFAULT_OUT = Path("/Volumes/T7/erp_turinova_new/modul-app/transfer/shoprenter-images")

SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def parse_gallery_db(raw: str | None) -> list[str]:
    raw = (raw or "").strip()
    if not raw or raw == "[]":
        return []
    try:
        v = json.loads(raw)
        if isinstance(v, list):
            return [x for x in v if isinstance(x, str) and x.strip()]
    except Exception:
        pass
    return []


def split_shoprenter_gallery(raw: str | None) -> list[str]:
    raw = (raw or "").strip()
    if not raw:
        return []
    if "|||" in raw:
        return [p.strip() for p in raw.split("|||") if p.strip()]
    return [raw]


def normalize_ftp_path(p: str) -> str:
    p = (p or "").strip().replace("\\", "/")
    while p.startswith("/"):
        p = p[1:]
    return p


def local_name_for(path: str, used: dict[str, str]) -> str:
    """Map ftp path → unique flat local filename. Reuse if path already assigned."""
    if path in used:
        return used[path]
    base = Path(path).name
    if not base:
        base = "image.jpg"
    stem = Path(base).stem
    ext = Path(base).suffix.lower() or ".jpg"
    candidate = f"{stem}{ext}"
    # collision with different path?
    taken = {v.lower(): k for k, v in used.items()}
    if candidate.lower() in taken and taken[candidate.lower()] != path:
        parent = Path(path).parent.name or "p"
        parent = SAFE_NAME.sub("_", parent)[:40] or "p"
        candidate = f"{parent}__{stem}{ext}"
    n = 2
    while candidate.lower() in taken and taken[candidate.lower()] != path:
        candidate = f"{stem}_{n}{ext}"
        n += 1
    used[path] = candidate
    return candidate


def load_accessories(csv_path: Path) -> dict[str, dict]:
    by_sku: dict[str, dict] = {}
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sku = (row.get("sku") or "").strip()
            if not sku:
                continue
            # first wins (export should be unique)
            if sku not in by_sku:
                by_sku[sku] = row
    return by_sku


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def build_import_xlsx(path: Path, rows: list[dict]) -> None:
    """Minimal accessories import: Azonosito, SKU, Kep_fajlnev, Galeria."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Termekek"
    headers = ["Azonosito", "SKU", "Kep_fajlnev", "Galeria"]
    ws.append(headers)
    for r in rows:
        ws.append(
            [
                r.get("accessory_id") or "",
                r.get("sku") or "",
                r.get("primary_local") or "",
                r.get("gallery_local") or "",
            ]
        )
    # text format for id/sku
    for col in ("A", "B"):
        for cell in ws[col]:
            cell.number_format = "@"
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    ap.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()
    out: Path = args.out
    reports = out / "reports"
    out.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True)
    (out / "to-upload").mkdir(parents=True, exist_ok=True)

    by_sku = load_accessories(args.csv)
    print(f"accessories skus={len(by_sku)}")

    wb = openpyxl.load_workbook(args.xlsx, read_only=True, data_only=True)
    sheet = wb["export"] if "export" in wb.sheetnames else wb.active
    it = sheet.iter_rows(values_only=True)
    header = [str(h or "").strip() for h in next(it)]
    print("xlsx headers:", header)

    path_to_local: dict[str, str] = {}
    manifest_rows: list[dict] = []
    unmatched: list[dict] = []
    import_rows: list[dict] = []
    shared: dict[str, list[str]] = defaultdict(list)

    stats = defaultdict(int)

    for row in it:
        cells = list(row) + [None] * 4
        cik = str(cells[0] or "").strip()
        gal_raw = str(cells[1] or "").strip()
        mpn = str(cells[2] or "").strip()
        primary_raw = str(cells[3] or "").strip()

        primary = normalize_ftp_path(primary_raw) if primary_raw else ""
        gallery = [normalize_ftp_path(p) for p in split_shoprenter_gallery(gal_raw)]
        gallery = [p for p in gallery if p]

        stats["xlsx_rows"] += 1
        if not mpn or mpn not in by_sku:
            unmatched.append(
                {
                    "shoprenter_cikkszam": cik,
                    "gyartoi_cikkszam": mpn,
                    "primary_ftp": primary,
                    "gallery_ftp": "|||".join(gallery),
                    "reason": "no_sku" if not mpn else "sku_not_in_erp",
                }
            )
            stats["unmatched"] += 1
            continue

        acc = by_sku[mpn]
        erp_primary = (acc.get("image_url") or "").strip()
        erp_gal = parse_gallery_db(acc.get("web_gallery"))
        stats["matched"] += 1

        fill_primary = (not erp_primary) and bool(primary)
        fill_gallery = (not erp_gal) and bool(gallery)

        if not fill_primary and not fill_gallery:
            stats["matched_noop"] += 1
            continue

        stats["need_work"] += 1
        if fill_primary:
            stats["fill_primary"] += 1
        if fill_gallery:
            stats["fill_gallery"] += 1
        if primary and not fill_primary and fill_gallery and not erp_primary:
            stats["gallery_without_primary_flag"] += 1

        primary_local = ""
        if fill_primary and primary:
            primary_local = local_name_for(primary, path_to_local)
            shared[primary].append(mpn)

        gallery_locals: list[str] = []
        if fill_gallery:
            for p in gallery:
                if primary and p == primary:
                    continue  # primary not duplicated into gallery import
                loc = local_name_for(p, path_to_local)
                gallery_locals.append(loc)
                shared[p].append(mpn)

        # also ensure primary is in path-map even if only gallery? no
        gallery_local_joined = " | ".join(gallery_locals)
        gallery_ftp_joined = "|||".join(gallery)

        mrow = {
            "accessory_id": acc.get("id") or "",
            "sku": mpn,
            "shoprenter_cikkszam": cik,
            "primary_ftp": primary if fill_primary else "",
            "primary_local": primary_local,
            "gallery_ftp": gallery_ftp_joined if fill_gallery else "",
            "gallery_local": gallery_local_joined,
            "action_primary": "fill" if fill_primary else "keep",
            "action_gallery": "fill" if fill_gallery else "keep",
            "status": "ready",
        }
        if fill_gallery and not primary and not erp_primary:
            mrow["status"] = "gallery_only_no_primary"
        manifest_rows.append(mrow)
        import_rows.append(mrow)

    # path-map
    path_rows = [
        {
            "ftp_path": ftp,
            "local_filename": loc,
            "sku_count": len(set(shared.get(ftp, []))),
            "status": "pending",
        }
        for ftp, loc in sorted(path_to_local.items(), key=lambda x: x[0])
    ]

    shared_rows = [
        {
            "ftp_path": ftp,
            "local_filename": path_to_local[ftp],
            "skus": ",".join(sorted(set(skus))),
            "sku_count": len(set(skus)),
        }
        for ftp, skus in sorted(shared.items())
        if len(set(skus)) > 1
    ]

    # ERP no image and not in matched xlsx set for primary
    xlsx_mpns = set()
    wb2 = openpyxl.load_workbook(args.xlsx, read_only=True, data_only=True)
    sheet2 = wb2["export"] if "export" in wb2.sheetnames else wb2.active
    it2 = sheet2.iter_rows(values_only=True)
    next(it2)
    for row in it2:
        cells = list(row) + [None] * 4
        mpn = str(cells[2] or "").strip()
        if mpn:
            xlsx_mpns.add(mpn)

    erp_missing = []
    for sku, acc in by_sku.items():
        if (acc.get("image_url") or "").strip():
            continue
        if sku in xlsx_mpns:
            continue
        erp_missing.append(
            {
                "accessory_id": acc.get("id") or "",
                "sku": sku,
                "name": (acc.get("name") or "")[:120],
            }
        )

    write_csv(
        out / "manifest.csv",
        [
            "accessory_id",
            "sku",
            "shoprenter_cikkszam",
            "primary_ftp",
            "primary_local",
            "gallery_ftp",
            "gallery_local",
            "action_primary",
            "action_gallery",
            "status",
        ],
        manifest_rows,
    )
    write_csv(
        out / "path-map.csv",
        ["ftp_path", "local_filename", "sku_count", "status"],
        path_rows,
    )
    write_csv(
        reports / "unmatched-xlsx.csv",
        ["shoprenter_cikkszam", "gyartoi_cikkszam", "primary_ftp", "gallery_ftp", "reason"],
        unmatched,
    )
    write_csv(
        reports / "matched-ok.csv",
        [
            "accessory_id",
            "sku",
            "action_primary",
            "action_gallery",
            "primary_local",
            "gallery_local",
            "status",
        ],
        manifest_rows,
    )
    write_csv(
        reports / "shared-images.csv",
        ["ftp_path", "local_filename", "skus", "sku_count"],
        shared_rows,
    )
    write_csv(
        reports / "erp-no-image-no-xlsx.csv",
        ["accessory_id", "sku", "name"],
        erp_missing,
    )

    build_import_xlsx(out / "accessories-image-import.xlsx", import_rows)

    summary = {
        "stats": dict(stats),
        "manifest_products": len(manifest_rows),
        "unique_ftp_files": len(path_rows),
        "shared_files": len(shared_rows),
        "unmatched_xlsx": len(unmatched),
        "erp_no_image_no_xlsx": len(erp_missing),
        "import_rows": len(import_rows),
        "out": str(out),
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
