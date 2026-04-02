# Raspberry Pi jelenlét terminál — egyezés az ERP-vel

## Forrásigazság (mit tart karban ez a repo?)

| Réteg | Hol van | Megjegyzés |
|--------|---------|------------|
| **Szerver (kanonikus)** | `main-app/src/app/api/attendance/terminal/scan/route.ts` | Minden deploy innen jön; ez az egyetlen hivatalos HTTP szerződés. |
| **Adatbázis** | Supabase migrációk (`attendance_logs`, `locations`, `employees`, nézetek) | A Pi **nem** tart sémát; csak a fenti API-t hívja. |
| **Raspberry Pi (kliens)** | `raspberry-pi-attendance/` (ütemezés nélküli példa) | A tényleges futó fájlok a Pi-n vannak; a repóban lévő példa **folyamatos** olvasás, **nincs** munkaidő-szűrés a kliensen. |

**Összefoglalva:** A visszavont / a Pi-ra másolt fájlok **nem befolyásolják** a futó ERP-t, amíg **nincsenek commitolva** ebbe a repóba. A terminál csak a **deployolt main-app** URL-jét és a **megosztott titkot** kell egyeztesse.

---

## Szerver végpont (main-app)

| | |
|---|---|
| **URL** | `POST {MAIN_APP_ORIGIN}/api/attendance/terminal/scan` |
| **Példa** | `https://your-domain.com/api/attendance/terminal/scan` |
| **Auth fejléc** | `X-Terminal-Secret: <ugyanaz, mint a szerveren>` |
| **Szerver env** | `ATTENDANCE_TERMINAL_SECRET` (kötelező egyezés a fejléccel) |

### Request body (JSON)

```json
{
  "locationId": "<uuid a public.locations táblából, aktív helyszín>",
  "cardId": "<RFID string>"
}
```

vagy

```json
{
  "locationId": "<uuid>",
  "pin": "1234"
}
```

**Pontosan egy** legyen: `cardId` **vagy** `pin` (4 számjegy).

### Sikeres válasz (201)

```json
{
  "ok": true,
  "logId": "...",
  "employeeId": "...",
  "employeeName": "...",
  "scanType": "arrival|departure|arrival_pin|departure_pin",
  "scanTime": "2026-03-30T08:00:00.000Z"
}
```

### Hibák

- `401` — rossz vagy hiányzó `X-Terminal-Secret`
- `400` — hiányzó/érvénytelen `locationId`, vagy rossz body
- `404` — ismeretlen kártya / PIN
- `409` — több dolgozó ugyanazzal a kártyával/PIN-nel (adatbázis hiba)

**Implementáció (egyetlen illesztési pont):** `main-app/src/app/api/attendance/terminal/scan/route.ts`

---

## Időzóna

- A szerver az érkezés/távozás váltását **Europe/Budapest** naptári nap szerint számolja (`formatDateInTz` a route-ban).
- A **Raspberry Pi** OS ideje legyen **Europe/Budapest** (`timedatectl`).

---

## Adatbázis (Supabase)

- `locations` — `id` = a terminál `locationId`-ja; `active = true`
- `employees` — `rfid_card_id` vagy `pin_code`; `active`, `deleted_at IS NULL`
- `attendance_logs` — minden sikeres scan ide kerül

---

## Ütemezés (csak a Pi / kliens — nem a szerver, nem ez a repo)

A szerver **nem** utasítja el a kérést munkaidőn kívül. Ha a terminál csak adott órákban küld scaneket, azt **a Pi szkript** kezeli; **ez a repó nem tartalmaz** Raspberry Pi ütemező kódot.

(Tervezett ablakok, ha a kliensen implementálod: hétköznap 06:00–18:00, szombat 06:00–13:00, vasárnap kikapcs — önkéntes szabály.)

---

## Környezeti változók (példa a Pi-n — nem a repo része)

```bash
export ATTENDANCE_API_BASE="https://your-main-app.com"
export ATTENDANCE_TERMINAL_SECRET="..."   # ugyanaz, mint a szerver .env (main-app)
export ATTENDANCE_LOCATION_ID="uuid"      # locations.id ehhez az olvasóhoz
```

Tényleges kérés:

`POST $ATTENDANCE_API_BASE/api/attendance/terminal/scan`

Fejléc: `X-Terminal-Secret: $ATTENDANCE_TERMINAL_SECRET`

---

## Ellenőrzőlista (Pi + ERP egyezés)

1. **Szerver deploy** a legutóbbi `main-app` (beleértve `terminal/scan/route.ts`).
2. **Ugyanaz a** `ATTENDANCE_TERMINAL_SECRET` a szerveren és a Pi környezetben.
3. **`locationId`** = létező, `active` sor a `locations` táblában.
4. **Dolgozó** `rfid_card_id` / `pin_code` egyezik a kártyával/PIN-nel.
5. Pi **HTTPS** és elérheti a main-app **nyilvános** URL-jét (nem localhost, kivéve tunnel).

---

## Pi hibaelhárítás: `Failed to load environment files` / `Result: resources`

**Ok:** a `systemd` unit tartalmaz `EnvironmentFile=/etc/attendance/terminal.env`, de a fájl **hiányzik** (pl. nem másoltad a `terminal.env`-t a Pi `/tmp`-jébe, csak a `.py` és a `.service` fájlt).

**Tünet a journalban:** `Failed to load environment files: No such file or directory`, majd `Failed to spawn 'start' task`, és a szolgáltatás **végtelen újraindítással** fut.

**Lépések a Pi-n (SSH):**

```bash
# 1) Állítsd le a restart hurkot
sudo systemctl stop attendance-terminal.service

# 2) Hozd létre a környezeti fájlt (értékeket cseréld le!)
sudo nano /etc/attendance/terminal.env
sudo chmod 600 /etc/attendance/terminal.env
sudo chown root:root /etc/attendance/terminal.env
```

Példa tartalom: lásd a repóban `docs/attendance-terminal.env.example` — a **változóneveknek egyezniük kell** a `attendance_terminal.py`-ban olvasott nevekkel.

```bash
# 3) Ellenőrizd: szkript és unit
ls -la /opt/attendance-terminal/attendance_terminal.py
sudo systemctl cat attendance-terminal.service

# 4) Újratöltés és indítás
sudo systemctl daemon-reload
sudo systemctl start attendance-terminal.service
sudo systemctl status attendance-terminal.service --no-pager
journalctl -u attendance-terminal -n 30 --no-pager
```

**Megjegyzés:** A `list-timers` kimenetében csak rendszer időzítők (apt, logrotate) látszanak — ez **nem** a jelenlét ütemezés; az ütemezés a **Python szkriptben** lenne, ha a másolt `attendance-terminal.service` leírása „scheduled scan windows” — a tényleges viselkedés a **telepített `.py`** fájltól függ.
