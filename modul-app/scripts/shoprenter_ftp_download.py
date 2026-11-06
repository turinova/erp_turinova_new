#!/usr/bin/env python3
"""Download Shoprenter product images listed in path-map.csv via SFTP.

Env:
  SHOPRENTER_SFTP_HOST     default vasalatmester.sftp.shoprenter.hu
  SHOPRENTER_SFTP_PORT     default 2222
  SHOPRENTER_SFTP_USER     default vasalatmester
  SHOPRENTER_SFTP_PASS     required

Usage:
  SHOPRENTER_SFTP_PASS='…' python3 scripts/shoprenter_ftp_download.py
  python3 scripts/shoprenter_ftp_download.py --limit 20
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

DEFAULT_OUT = Path("/Volumes/T7/erp_turinova_new/modul-app/transfer/shoprenter-images")


def load_path_map(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_path_map(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    fields = list(rows[0].keys())
    if "bytes" not in fields:
        fields.append("bytes")
    if "error" not in fields:
        fields.append("error")
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=1)  # sequential; paramiko one conn
    args = ap.parse_args()

    out: Path = args.out
    path_map_file = out / "path-map.csv"
    dest = out / "to-upload"
    progress_file = out / "download-progress.json"
    failures_file = out / "reports" / "download-failures.csv"
    dest.mkdir(parents=True, exist_ok=True)
    (out / "reports").mkdir(parents=True, exist_ok=True)

    host = os.environ.get("SHOPRENTER_SFTP_HOST", "vasalatmester.sftp.shoprenter.hu")
    port = int(os.environ.get("SHOPRENTER_SFTP_PORT", "2222"))
    user = os.environ.get("SHOPRENTER_SFTP_USER", "vasalatmester")
    password = os.environ.get("SHOPRENTER_SFTP_PASS", "")
    if not password:
        print("Missing SHOPRENTER_SFTP_PASS", file=sys.stderr)
        sys.exit(1)

    try:
        import paramiko
    except ImportError:
        print("Installing paramiko…", flush=True)
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "paramiko"])
        import paramiko

    rows = load_path_map(path_map_file)
    progress = {"ok": {}, "fail": {}, "started_at": None, "updated_at": None}
    if progress_file.exists():
        try:
            progress = json.loads(progress_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    if not progress.get("started_at"):
        progress["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")

    pending = []
    for r in rows:
        ftp = (r.get("ftp_path") or "").strip()
        local = (r.get("local_filename") or "").strip()
        if not ftp or not local:
            continue
        local_path = dest / local
        if local_path.exists() and local_path.stat().st_size > 0:
            r["status"] = "ok"
            r["bytes"] = str(local_path.stat().st_size)
            progress.setdefault("ok", {})[ftp] = local
            continue
        if ftp in progress.get("ok", {}):
            continue
        pending.append(r)

    if args.limit and args.limit > 0:
        pending = pending[: args.limit]

    print(f"path-map={len(rows)} pending={len(pending)} dest={dest}")
    if not pending:
        save_path_map(path_map_file, rows)
        print("Nothing to download.")
        return

    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    assert sftp is not None

    # probe roots
    try:
        root_listing = sftp.listdir(".")
        print("sftp cwd listing sample:", root_listing[:20])
    except Exception as e:
        print("listdir . failed:", e)

    failures: list[dict] = []
    ok_n = fail_n = 0
    t0 = time.time()

    def try_get(remote: str, local_path: Path) -> None:
        # try as-is, then with leading variants already normalized
        candidates = [remote, "/" + remote]
        last_err: Exception | None = None
        for cand in candidates:
            try:
                sftp.get(cand, str(local_path))
                return
            except Exception as e:
                last_err = e
        raise last_err or FileNotFoundError(remote)

    try:
        for i, r in enumerate(pending, 1):
            ftp = r["ftp_path"].strip()
            local = r["local_filename"].strip()
            local_path = dest / local
            tmp = dest / (local + ".part")
            try:
                try_get(ftp, tmp)
                tmp.replace(local_path)
                size = local_path.stat().st_size
                r["status"] = "ok"
                r["bytes"] = str(size)
                r["error"] = ""
                progress.setdefault("ok", {})[ftp] = local
                progress.get("fail", {}).pop(ftp, None)
                ok_n += 1
            except Exception as e:
                if tmp.exists():
                    try:
                        tmp.unlink()
                    except Exception:
                        pass
                msg = str(e)
                r["status"] = "fail"
                r["error"] = msg[:300]
                progress.setdefault("fail", {})[ftp] = msg[:300]
                failures.append(
                    {
                        "ftp_path": ftp,
                        "local_filename": local,
                        "error": msg[:500],
                    }
                )
                fail_n += 1

            if i % 25 == 0 or i == len(pending):
                elapsed = time.time() - t0
                rate = i / elapsed if elapsed else 0
                print(
                    f"  {i}/{len(pending)} ok={ok_n} fail={fail_n} "
                    f"{rate:.1f}/s elapsed={elapsed:.0f}s",
                    flush=True,
                )
                progress["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                progress_file.write_text(
                    json.dumps(progress, indent=2, ensure_ascii=False), encoding="utf-8"
                )
                save_path_map(path_map_file, rows)
    finally:
        sftp.close()
        transport.close()

    if failures:
        with failures_file.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["ftp_path", "local_filename", "error"])
            w.writeheader()
            w.writerows(failures)

    progress["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    progress_file.write_text(json.dumps(progress, indent=2, ensure_ascii=False), encoding="utf-8")
    save_path_map(path_map_file, rows)
    print(f"done ok={ok_n} fail={fail_n} failures_file={failures_file}")


if __name__ == "__main__":
    main()
