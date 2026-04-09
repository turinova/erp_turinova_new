# Foot counter Pi → main-app sync (tracked in ERP repo)

The Raspberry Pi **preview / Hailo app** is **not** committed (`raspberry-pi-footcounter/` is gitignored). This folder has **shared HTTP client**, **batch catch-up script**, **one-event test CLI**, SQL migration, and docs you copy to the Pi.

## Architecture

1. **Per-event:** Repo **`preview_hailo_mjpeg.py`** assigns **`client_event_id`**, inserts into SQLite, then **`footcounter_per_event_sync.schedule_crossing_sync`** POSTs `events: [ one ]` in a **daemon thread** and sets **`synced_at`** on success. Deploy steps: **`DEPLOY_PER_EVENT.md`**.
2. **Catch-up:** `sync_to_supabase.py` uploads rows where `synced_at IS NULL`. Run manually or via **cron** (safety net).

---

## Files on the Pi (`/opt/footcounter/`)

| File | Role |
|------|------|
| `footcounter_sync_client.py` | `post_sync_events(...)` — used by per-event module + batch script |
| `footcounter_per_event_sync.py` | `schedule_crossing_sync(...)` — called from preview after each insert |
| `preview_hailo_mjpeg.py` | Hailo MJPEG server + counting + per-event sync |
| `sync_to_supabase.py` | Batch sync (up to 200 rows per run) |
| `push_one_event.py` | Manual test: POST one synthetic event |
| `config.env` | `FOOTCOUNTER_SYNC_*`, `FOOTCOUNTER_DB_PATH`, etc. |

---

## systemd: install preview service (if `Unit not found`)

Your Pi had **no** `footcounter-preview.service` yet. Install once:

**Mac** (copy unit file):

```bash
cd /Volumes/T7/erp_turinova_new
scp scripts/footcounter-pi/systemd/footcounter-preview.service turinova@footcounter.local:/tmp/
```

**Pi** (edit `User=` / `ExecStart=` if your script or username differs):

```bash
ssh turinova@footcounter.local
ls -la /opt/footcounter/preview_hailo_mjpeg.py
sudo cp /tmp/footcounter-preview.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now footcounter-preview.service
sudo systemctl status footcounter-preview.service
```

If `status` shows **failed**, check logs: `journalctl -u footcounter-preview.service -n 50 --no-pager`.

**Cron log file:** if cron cannot write `/var/log/footcounter-sync.log`, use e.g. `>> /home/turinova/footcounter-sync.log` or `sudo touch /var/log/footcounter-sync.log && sudo chown turinova:turinova /var/log/footcounter-sync.log`.

---

## Commands to run **after** you pull this repo change (Mac + Pi)

**Skip** anything you already did (migrations, `npm run dev`, old single-file `scp`). These assume the Pi user/host `turinova@footcounter.local` and path `/opt/footcounter/`.

### On your Mac (from repo root)

Copy the **new / updated** Python modules to the Pi:

```bash
cd /Volumes/T7/erp_turinova_new
scp scripts/footcounter-pi/footcounter_sync_client.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/sync_to_supabase.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/push_one_event.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/PREVIEW_PER_EVENT_HOOK.md turinova@footcounter.local:/opt/footcounter/
```

Deploy **main-app** so `/api/footcounter/sync` is live (Vercel deploy or local `npm run dev`). No new server env vars are required for this change.

### On the Pi (SSH)

```bash
ssh turinova@footcounter.local
chmod +x /opt/footcounter/sync_to_supabase.py /opt/footcounter/push_one_event.py
cd /opt/footcounter
python3 push_one_event.py --direction in
```

Expected: prints `ok` and a UUID. If it errors, fix `FOOTCOUNTER_SYNC_URL` / `FOOTCOUNTER_SYNC_SECRET` in `config.env` and ensure the Mac or Vercel app is reachable from the Pi.

Optional — **cron safety net** (every 10 minutes; adjust user if needed):

```bash
crontab -e
```

Add:

```cron
*/10 * * * * /usr/bin/python3 /opt/footcounter/sync_to_supabase.py >> /var/log/footcounter-sync.log 2>&1
```

### Per-event deploy (full list)

See **`DEPLOY_PER_EVENT.md`** — `scp` preview + `footcounter_per_event_sync.py`, restart **`footcounter-preview.service`**.

---

## One-time reference (Supabase, env, migration)

1. **Supabase:** from repo root `npx supabase db push`, or run `supabase/migrations/20260410_footcounter_crossings.sql` in the SQL editor.
2. **Mac `main-app/.env.local`:** `FOOTCOUNTER_SYNC_SECRET` (same as Pi), `SUPABASE_SERVICE_ROLE_KEY`, Supabase URL/anon key.
3. **Vercel:** same server secrets for Production.
4. **Pi SQLite migration** (if not done):

   ```bash
   sqlite3 /var/lib/footcounter/events.sqlite < /opt/footcounter/scripts/sql/migrate_sqlite_crossing_events.sql
   ```

5. **Pi `config.env`:**  
   `FOOTCOUNTER_SYNC_URL`, `FOOTCOUNTER_SYNC_SECRET`, `FOOTCOUNTER_DEVICE_SLUG=default`, `FOOTCOUNTER_LOG_CROSSINGS=1`, `FOOTCOUNTER_DB_PATH`.

---

## Verify in the ERP

1. `http://localhost:3000/footcounter-live` (or production URL), logged in → **Adatok frissítése**.
2. After `push_one_event.py` or a real crossing + sync, **Ma — Be / Ki** and the chart should update.

---

## Troubleshooting

| Issue | Check |
|--------|--------|
| `503` on sync | `FOOTCOUNTER_SYNC_SECRET` missing on server `.env` / Vercel. |
| `401` on sync | Secret mismatch Pi vs server. |
| `ModuleNotFoundError: footcounter_sync_client` | Run scripts from `/opt/footcounter` with both `.py` files present. |
| Stats empty | `SUPABASE_SERVICE_ROLE_KEY`, migration applied, slug `default`. |
| Stream on Vercel | LAN MJPEG URL won’t work from Vercel; use tunnel or `NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL`. |
