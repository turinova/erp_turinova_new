# Foot counter Raspberry Pi (not in this git repo)

Pi application code is maintained **outside** the main ERP repo (see root `.gitignore`: `raspberry-pi-footcounter/`). This doc is the **operational** checklist for systemd and networking so **main-app → Bejárat élő** works.

## Boot → auto-start (no manual `python3` after setup)

1. Install deps on Pi: `python3-picamera2`, `python3-opencv`, `hailo-all` (for Hailo preview).
2. Deploy scripts to `/opt/footcounter/` (rsync from your private copy of the Pi project).
3. Create `/opt/footcounter/config.env` (preview port, line position, etc.).
4. Install a **systemd** unit (example below), then:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now footcounter-preview.service
   ```

5. Reboot: MJPEG should be at `http://<pi-ip>:8000/stream.mjpg` (port from `PREVIEW_PORT` in `config.env`).

### Example unit: `/etc/systemd/system/footcounter-preview.service`

```ini
[Unit]
Description=Foot counter Hailo MJPEG preview
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=turinova
WorkingDirectory=/opt/footcounter
EnvironmentFile=-/opt/footcounter/config.env
ExecStart=/usr/bin/python3 /opt/footcounter/preview_hailo_mjpeg.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust `User`, paths, and script name if you use plain `preview_mjpeg.py`.

## Main-app environment

- **`FOOTCOUNTER_MJPEG_URL`**: URL the **Next.js server** can open (e.g. Pi Tailscale IP + `/stream.mjpg`). Set on the host that runs `next start`.
- If the server cannot reach the Pi or hits **serverless timeouts** on long MJPEG, set **`NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL`** to an **HTTPS** URL (tunnel) so the **browser** loads the stream directly.

## Supabase

- Permissions page: migration `20260409_footcounter_live_page.sql`.
- **Sync + charts:** migration `20260410_footcounter_crossings.sql` (devices + per-event crossings; optional `footcounter_dashboard_stats` RPC).

**Charts / Ma Be–Ki:** `/api/footcounter/stats` reads `footcounter_devices` and `footcounter_crossings` with the service role (no PostgREST RPC required). If **`footcounter_crossings` is empty**, the live page shows zeros after refresh — that is expected until sync runs.

**Why counts disappear on refresh:** The MJPEG preview can show **in-memory** crossing counts while it runs; **persisted** Ma Be / Ki on the dashboard come only from **rows in Supabase** (or from the Pi SQLite after a sync). Enable **`FOOTCOUNTER_LOG_CROSSINGS=1`** in Pi `config.env`, ensure **`FOOTCOUNTER_SYNC_URL`** / **`FOOTCOUNTER_SYNC_SECRET`** match **`POST /api/footcounter/sync`**, and either **push each event** from the preview (see `scripts/footcounter-pi/PREVIEW_PER_EVENT_HOOK.md`) or run **`sync_to_supabase.py`** / cron for catch-up.

## Pi → Supabase sync (step-by-step)

**Repo:** `scripts/footcounter-pi/DEPLOY_PER_EVENT.md` — deploy **`footcounter_sync_client.py`**, **`footcounter_per_event_sync.py`**, **`preview_hailo_mjpeg.py`**, **`sync_to_supabase.py`**, **`push_one_event.py`** to `/opt/footcounter/` (per-event sync is built into the preview).

Main-app needs **`FOOTCOUNTER_SYNC_SECRET`** and **`SUPABASE_SERVICE_ROLE_KEY`** (for `/api/footcounter/stats`).
