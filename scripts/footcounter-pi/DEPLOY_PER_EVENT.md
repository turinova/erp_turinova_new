# Deploy per-event sync (preview + helpers)

After this change, **`preview_hailo_mjpeg.py`** inserts **`client_event_id`**, then **`schedule_crossing_sync`** POSTs each crossing in a background thread. **`FOOTCOUNTER_SYNC_URL`** and **`FOOTCOUNTER_SYNC_SECRET`** must be set in Pi **`config.env`**.

---

## On your Mac (Terminal)

From the repo root (adjust host/user if needed):

```bash
cd /Volumes/T7/erp_turinova_new

scp scripts/footcounter-pi/footcounter_sync_client.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/footcounter_per_event_sync.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/sync_to_supabase.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/push_one_event.py turinova@footcounter.local:/opt/footcounter/
scp scripts/footcounter-pi/preview_hailo_mjpeg.py turinova@footcounter.local:/opt/footcounter/
```

Ensure **`main-app`** is running (local **`npm run dev`** or Vercel) so **`/api/footcounter/sync`** answers from the Pi.

### Preview only (e.g. MJPEG clock overlay)

**Mac:**

```bash
cd /Volumes/T7/erp_turinova_new
scp scripts/footcounter-pi/preview_hailo_mjpeg.py turinova@footcounter.local:/opt/footcounter/
```

**Pi (SSH):**

```bash
ssh turinova@footcounter.local
sudo systemctl restart footcounter-preview.service
```

Optional in **`config.env`**: `FOOTCOUNTER_OVERLAY_TZ=Europe/Budapest` (default). If the on-screen clock stops moving, the stream is frozen.

---

## On the Pi (SSH)

```bash
ssh turinova@footcounter.local

chmod +x /opt/footcounter/sync_to_supabase.py /opt/footcounter/push_one_event.py /opt/footcounter/footcounter_per_event_sync.py

grep -E 'FOOTCOUNTER_SYNC_URL|FOOTCOUNTER_SYNC_SECRET|FOOTCOUNTER_LOG_CROSSINGS|FOOTCOUNTER_DB_PATH' /opt/footcounter/config.env
```

If **`FOOTCOUNTER_SYNC_URL`** or **`FOOTCOUNTER_SYNC_SECRET`** is missing, edit **`config.env`** (example for dev on LAN):

```bash
nano /opt/footcounter/config.env
```

Add or fix (use your Mac’s LAN IP and the **same** secret as **`FOOTCOUNTER_SYNC_SECRET`** in **`main-app/.env.local`**):

```bash
FOOTCOUNTER_SYNC_URL=http://192.168.x.x:3000/api/footcounter/sync
FOOTCOUNTER_SYNC_SECRET=your-long-random-secret
FOOTCOUNTER_DEVICE_SLUG=default
FOOTCOUNTER_LOG_CROSSINGS=1
FOOTCOUNTER_DB_PATH=/var/lib/footcounter/events.sqlite
```

Restart preview:

```bash
sudo systemctl restart footcounter-preview.service
sudo systemctl status footcounter-preview.service
```

Smoke-test HTTP sync (optional):

```bash
cd /opt/footcounter
python3 push_one_event.py --direction in
```

Confirm hook is present (optional):

```bash
grep -n schedule_crossing_sync /opt/footcounter/preview_hailo_mjpeg.py | head -3
```

---

## On your Mac (browser)

Open **`http://localhost:3000/footcounter-live`**, refresh stats after a real crossing or **`push_one_event.py`**.
