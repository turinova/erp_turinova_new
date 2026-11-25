# 63 — Bolti kiosk Raspberry Pi 5 telepítés

**Állapot:** 2026-11-25.  
**Termék:** [60](60-bolti-kiosk.md) · UX: [61](61-bolti-kiosk-ux.md) · Pult: [62](62-bolti-kiosk-pult-workflow.md).  
**Scriptek:** repo gyökér `bolti-kiosk-pi/`.

---

## 0. Egy mondat

> A Pi 5 bootol → teljes képernyős Chromium a `/k/<slug>`-ra; a monitor a **Beállítások → Cégadatok** nyitvatartása szerint kapcsol be **5 perccel korábban** és ki **5 perccel később**; a vevő nem tud kilépni.

---

## 1. Mit csinál a rendszer

| Réteg | Hol |
|---|---|
| Webapp (anyag, kosár, leadás) | `https://app.optinova.hu/k/…` |
| Nyitvatartás forrás | `tenant_companies.opening_hours` (Cégadatok) |
| Pi lekérdezés | `GET /api/kiosk/<slug>/hours` → `{ displayOn, open, hours }` |
| Monitor be/ki | `wlr-randr` percente (`schedule.sh`) |
| Kilépés ellen | Chromium `--kiosk` + labwc billentyűtiltás + watchdog újraindítás |
| Wi‑Fi | `check-wifi.sh` (reconnect, 5 fail → reboot) |

**Nem** a webapp idle resetje (75/90 mp) kapcsolja a monitort — az csak a rendelést nullázza.

---

## 2. Előfeltételek

- Raspberry **Pi 5**, microSD (≥16 GB), HDMI monitor, **egér**, táp.
- A pulton **ne legyen billentyűzet** (kilépés ellen).
- Wi‑Fi jelszó, Mac-en **Raspberry Pi Imager**.
- Staff: Kiosk bekapcsolva + eszköz + párosító link.
- Cégadatokban kitöltött nyitvatartás.

---

## 3. SD kártya (Imager) — kezdőknek

1. Nyisd a **Raspberry Pi Imager**-t.
2. Device: **Raspberry Pi 5**.
3. OS: **Raspberry Pi OS (64-bit)** — Desktop (nem Lite).
4. Storage: az SD.
5. Fogaskerék / Edit Settings:
   - Hostname: `bolti-kiosk`
   - Username: `kiosk` + erős jelszó (jegyezd meg)
   - Wi‑Fi: bolti hálózat + jelszó
   - Locale: **Europe/Budapest**, billentyűzet HU
   - **Enable SSH** (jelszóval)
6. Write → SD a Pi-be → monitor + egér + táp → várj 2–3 percet.

---

## 4. Csomag felmásolása a Pi-re

Mac-en, a repo gyökeréből (Wi‑Fi-n a Pi már fent van):

```bash
# config.env már kitöltve a pairing URL-lel (helyi, gitignore)
scp -r bolti-kiosk-pi kiosk@bolti-kiosk.local:~/
```

Ha a `.local` nem megy: a routerben nézd meg a Pi IP-jét, majd `kiosk@192.168.x.x`.

SSH:

```bash
ssh kiosk@bolti-kiosk.local
cd ~/bolti-kiosk-pi
bash install.sh
```

Az `install.sh` telepíti a Chromiumot, a scripteket, a cronokat, az autologint.

---

## 5. Párosítás (egyszer)

A grafikus asztalon (monitoron), SSH-ból:

```bash
/usr/local/bin/bolti-kiosk-pair
```

25 mp-ig megnyitja a párosító linket → a token a Chromiumba kerül.  
Utána **töröld** a `KIOSK_PAIRING_URL` sort mindkét helyen:

```bash
nano ~/bolti-kiosk-pi/config.env
sudo nano /etc/bolti-kiosk/config.env
```

Majd:

```bash
sudo reboot
```

---

## 6. Ellenőrzés

| Teszt | Elvárt |
|---|---|
| Reboot | Teljes képernyős kiosk, Attract |
| `curl -s https://app.optinova.hu/api/kiosk/hiros-ablak-kft/hours` | JSON: `displayOn`, `open`, `hours` |
| Cégadatokban zárás módosítva | 1 percen belül a Pi követi |
| Leadás | Draft megjelenik a Kezdőlapon |
| Egérrel Alt+F4 nélkül | Nem lehet „asztalra” jutni |

Monitor kézi teszt:

```bash
/usr/local/bin/bolti-kiosk-display off
/usr/local/bin/bolti-kiosk-display on
/usr/local/bin/bolti-kiosk-schedule
```

---

## 7. Nyitvatartás változtatása

Csak a weben: **Beállítások → Cégadatok → nyitvatartás**.  
A Pi percenként kérdez; **±5 perc** a pad (szerveren fix). Nincs cron-óra a Pi-n a nyitáshoz.

Ha nincs megadva nyitvatartás → a monitor **bekapcsolva** marad (ne kapcsoljuk le tévedésből).

---

## 8. Hibaelhárítás

| Tünet | Mit nézz |
|---|---|
| Üres / hiba a kioskon | Wi‑Fi, `ping app.optinova.hu` |
| „Eszköz nem párosítva” / 401 | Új párosító link + `bolti-kiosk-pair` (nem incognito) |
| Monitor nem alszik el | `crontab -l`, `curl` hours API, `journalctl` nincs — nézd `/tmp/bolti-kiosk-display-state` |
| Chromium „Restore?” | A script törli a crashed flaget; reboot |
| SSH nem megy | Router IP, vagy ideiglenes billentyűzet a Pi-n |

Admin belépés később: SSH a Mac-ről (billentyűzet nélkül a pulton).

---

## 9. Fájlok

| Fájl | Szerep |
|---|---|
| `bolti-kiosk-pi/install.sh` | Egyparancsos telepítő |
| `bolti-kiosk-pi/config.env.example` | Sablon |
| `scripts/kiosk.sh` | Chromium kiosk + újraindítás |
| `scripts/schedule.sh` | hours API → display on/off |
| `scripts/display.sh` | `wlr-randr` |
| `scripts/check-wifi.sh` | Wi‑Fi watchdog |
| `scripts/pair-once.sh` | Egyszeri párosítás |
| `modul-app/.../api/kiosk/[slug]/hours` | Nyitvatartás + `displayOn` |
