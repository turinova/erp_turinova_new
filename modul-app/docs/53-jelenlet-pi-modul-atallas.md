# 53 — Jelenlét: Raspberry Pi átállítása a modul-appra

**Státusz:** terv — még nincs implementálva  
**Cél:** a main-app megszűnik; a Pi terminál **ugyanúgy működik, mint ma**, csak a modul-appba ír, és a készülék egy **tenanthoz** van kötve.  
Kapcsolódó: [34-jelenlet-addon.md](34-jelenlet-addon.md), [jelenlet-pi.md](jelenlet-pi.md), `docs/raspberry-pi-attendance.md` (main-app), `raspberry-pi-attendance/`

---

## Elv

- A Pi működése **nem változik**: ő dönti el az érkezés/távozást, 30 mp cooldown, kézi zárolás (mindkét idő kézi → kihagy), offline SQLite sor, GUI — minden marad.
- **Csak az adatréteg cserélődik:** a Pi ma Supabase-kulccsal közvetlenül a main DB-be ír (`employees`, `attendance_logs`). Ehelyett a modul-app HTTP API-ját hívja.
- **Miért nem Supabase-kulcs?** A modul-app SaaS: egy közös adatbázis, minden tenant. Egy Pi-n lévő kulcs minden cég adatát elérné. Ezért a Pi a már meglévő **eszköztokennel** (`jelenlet_devices`) azonosít; a token mondja meg a tenantot.
- **Nem része:** PIN hash, nyers scan napló, szerveroldali típusdöntés, múltbeli adat költöztetése, új UI.

---

## Mai állapot (main-app)

| Pi függvény (`backend/attendance_logic.py`) | Mit csinál a main Supabase-en |
|---|---|
| `sync_employees_from_supabase`, `start_periodic_employee_sync(60)` | percenként: aktív `employees` → helyi `employees_cache` |
| `get_employee_by_card`, `get_employee_by_pin` | cache miss → `employees` lekérés kártya / PIN szerint |
| `_sync_employee_day_state_from_supabase`, `sync_today_day_states_from_supabase` | mai `attendance_logs` (`scan_time`, `scan_type`, `manually_edited`) → következő típus / zárolás |
| `get_last_scan_today`, `count_scans_today` | mai `attendance_logs` (tartalék logika) |
| `save_to_supabase` | `attendance_logs` insert |
| `sync_pending_logs`, `verify_log_in_supabase` | offline sor feltöltése + ellenőrzés |
| `get_today_attendance_feed` | napi lista képernyő |
| `notify_modul_app_scan`, `sync_modul_pending` | mellékcsatorna a modul-appra — **megszűnik** |

---

## modul-app: 3 végpont

Mind: `Authorization: Bearer <eszköztoken>` (vagy `x-jelenlet-secret`). Token → `jelenlet_devices` → `tenant_id`. Jelenlét add-on + aktív tenant ellenőrzés (mint a mostani `terminal/scan`). Service role, minden lekérdezés `tenant_id`-re szűr.

### `GET /api/jelenlet/terminal/employees`

A tenant aktív, nem archivált, nem törölt dolgozói — **main-kompatibilis mezőnevekkel**, hogy a Pi cache változatlan maradjon:

```json
{
  "employees": [
    {
      "id": "uuid",
      "name": "Tráj Zsolt",
      "employee_code": "TZS",
      "rfid_card_id": "A5C8DE05",
      "pin_code": "8445",
      "active": true,
      "lunch_break_start": "12:00",
      "lunch_break_end": "12:30",
      "works_on_saturday": true,
      "deleted_at": null
    }
  ]
}
```

Opcionális `?card=` / `?pin=` szűrés a cache-miss lekéréshez (`get_employee_by_card` / `_by_pin`).

### `GET /api/jelenlet/terminal/today?date=YYYY-MM-DD`

A nap bejegyzései a Pi resolverének formátumában (`_resolve_next_scan_from_logs`), `hr_attendance_days`-ből képezve — egy sor érkezésre, egy távozásra:

```json
{
  "logs": [
    { "employee_id": "uuid", "scan_time": "2026-11-09T07:58:00", "scan_type": "arrival", "manually_edited": false },
    { "employee_id": "uuid", "scan_time": "2026-11-09T16:30:00", "scan_type": "departure", "manually_edited": true }
  ]
}
```

- `scan_type`: `arrival` / `departure`, PIN-nél `_pin` utótag (`arrival_source = 'pin'`).
- `manually_edited`: mezőnként (`arrival_source` / `departure_source = 'manual'`).
- Opcionális `?employee_id=` (egy dolgozó állapota).
- Ez szolgálja ki: day-state szinkron, `get_last_scan_today`, `count_scans_today`, `get_today_attendance_feed` (név a `employees` cache-ből).

### `POST /api/jelenlet/terminal/logs`

Ugyanaz a `log_data`, amit a Pi ma összeállít (a `location_id` elhagyható):

```json
{
  "employee_id": "uuid",
  "scan_time": "2026-11-09T07:58:12",
  "scan_type": "arrival",
  "card_id": "A5C8DE05",
  "pin_used": false
}
```

Szerver:

1. `employee_id` a token tenantjához tartozik, aktív → különben `404`.
2. `scan_time` = a Pi helyi ideje (naiv ISO) → **Europe/Budapest** falióra; ebből `work_date` és `HH:MM`. Offline sorból később érkező log is a **valódi** időt kapja.
3. Típus a Pi döntése (`arrival*` → érkezés mező, `departure*` → távozás mező).
4. Ha a mező **kézi** (`*_source = 'manual'`) → nem írja felül, `200 { ok: true, skipped: "manual" }` (main view: a kézi nyer).
5. Különben upsert `hr_attendance_days`: a mező ideje + `*_source = 'rfid' | 'pin'`, `source = 'terminal'`; ebéd a dolgozó alapértelmezéséből, ha a napon még nincs.
6. Ugyanaz a log újraküldve (azonos dolgozó + típus + idő) → ugyanazt a választ adja (idempotens), így a `verify_log_in_supabase` helyett elég a `POST` sikere.
7. `jelenlet_devices.last_seen_at` frissül.

Válasz: `201 { ok: true, employee_id, work_date, arrival_time, departure_time }`.

> Megjegyzés: távollétes napon a mostani `terminal/scan` elutasít; az új végpont **rögzít** (main-app is rögzítette). Hogy számít-e, azt a jelenléti ív szabálya dönti el (`leavePlusWork`).

A mostani `POST /api/jelenlet/terminal/scan` az átállásig marad (mellékcsatorna), utána törölhető.

---

## Pi: adatréteg csere

Új fájl: `backend/modul_api.py` — kis HTTP kliens (`urllib`, timeout, Bearer token).

| Függvény | Változás |
|---|---|
| `init_supabase`, `supabase_reachable` | → `modul_api` init + `GET employees` probe |
| `sync_employees_from_supabase` | → `GET employees` → `upsert_employee_cache` (változatlan) |
| `get_employee_by_card` / `_by_pin` (online ág) | → `GET employees?card=` / `?pin=` |
| day-state szinkron, `get_last_scan_today`, `count_scans_today`, `get_today_attendance_feed` | → `GET today` |
| `save_to_supabase` | → `POST logs` |
| `sync_pending_logs`, `verify_log_in_supabase` | → `POST logs` (siker = szinkronizált; 4xx → sorból törlés + log, 5xx / hálózat → retry) |
| `notify_modul_app_scan`, `sync_modul_pending`, `modul_pending_scans` | törlés |

Változatlan: `determine_scan_type`, `_resolve_next_scan_from_logs`, `check_cooldown`, helyi day-state, `pending_logs`, `employees_cache`, GUI.

Konfig (`config.env`):

```bash
JELENLET_API_URL=https://app.optinova.hu
JELENLET_DEVICE_TOKEN=jl_...   # platform → Cég → Jelenlét → Új eszköz + token
```

Supabase URL / kulcs és `location_id` kikerül.

---

## Átállás lépései

1. **modul-app:** 3 végpont + tesztek (`terminal-api.test.ts`), deploy. A mostani Pi működése nem változik.
2. **Platform:** Hírös cégnél van eszköz + token (`jl_...`) — megvan.
3. **Dolgozók:** a modul-appban minden dolgozónál ugyanaz a kártya / PIN, mint a main-appban (ellenőrzés kézzel, `/dolgozok`).
4. **Pi:** `modul_api.py` + módosított `attendance_logic.py` felmásolása (Pi Connect / scp), `config.env` csere, szolgáltatás újraindítás.
5. **Próba:** kártya + PIN érkezés/távozás, offline próba (net le → 2 scan → net vissza → modul naptárban a valódi idők), kézi idő a naptárban → Pi tiszteletben tartja.
6. **main-app lekapcsolás** a Pi szempontjából: nincs több függőség.

## Kockázat

- Ha a modul-app nem elérhető: a Pi offline sorba ír (mint ma), visszaálláskor feltölt — valódi idővel.
- Token kiszivárgás: platformon új token, a régi visszavonva; csak az adott tenant érintett.
