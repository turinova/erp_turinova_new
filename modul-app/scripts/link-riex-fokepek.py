#!/usr/bin/env python3
"""Bulk-link riex főképek → accessories.image_url via Management API."""
import json
import os
import ssl
import subprocess
import time
import urllib.request

TENANT = "45dd7c02-28e9-4f4a-b74c-704f63437927"
PROGRESS = "/Volumes/T7/erp_turinova_new/modul-app/transfer/riex-fokepek-upload-progress.json"
PROJECT = "bcfsplmetuziczzxgsix"


def get_access():
    raw = subprocess.check_output(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
        text=True,
    ).strip()
    if raw.startswith("go-keyring-base64:"):
        import base64

        return base64.b64decode(raw.split(":", 1)[1]).decode()
    return raw


def make_ctx():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def q(access, ctx, sql, timeout=300):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {access}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        body = resp.read().decode()
        print(f"  {resp.status} {time.time()-t0:.1f}s {body[:180]}")
        return json.loads(body) if body else None


def main():
    access = get_access()
    ctx = make_ctx()
    progress = json.load(open(PROGRESS))
    pairs = []
    for name, url in progress["uploaded"].items():
        sku = name.rsplit(".", 1)[0].upper()
        pairs.append((sku, url))
    print(f"pairs={len(pairs)} tenant={TENANT}")

    # One roundtrip per chunk: UPDATE ... FROM (VALUES ...) — no temp table needed
    CHUNK = 400
    total_updated = 0
    for i in range(0, len(pairs), CHUNK):
        chunk = pairs[i : i + CHUNK]
        values = ",\n".join(
            "('%s'::text, '%s'::text)"
            % (sku.replace("'", "''"), url.replace("'", "''"))
            for sku, url in chunk
        )
        sql = f"""
with v(sku, public_url) as (
  values
  {values}
),
upd as (
  update public.accessories a
  set image_url = v.public_url,
      updated_at = now()
  from v
  where a.tenant_id = '{TENANT}'::uuid
    and a.deleted_at is null
    and upper(a.sku) = v.sku
    and (a.image_url is distinct from v.public_url)
  returning a.id, a.sku
)
select count(*)::int as updated from upd;
"""
        res = q(access, ctx, sql)
        updated = res[0]["updated"] if res else 0
        total_updated += updated
        print(f"chunk {min(i+CHUNK,len(pairs))}/{len(pairs)} updated={updated}")

    # verify
    res = q(
        access,
        ctx,
        f"""
select
  (select count(*) from public.media_files where tenant_id='{TENANT}'::uuid) as media,
  (select count(*) from public.accessories
    where tenant_id='{TENANT}'::uuid and deleted_at is null and image_url is not null) as with_img,
  (select count(*) from public.accessories
    where tenant_id='{TENANT}'::uuid and deleted_at is null and image_url is null) as no_img;
""",
    )
    print("totals", res)
    print(f"link_updated_total={total_updated}")

    # mark all linked in progress
    for sku, url in pairs:
        progress.setdefault("linked", {})[sku] = url
    with open(PROGRESS, "w") as f:
        json.dump(progress, f)
    print("progress saved")


if __name__ == "__main__":
    main()
