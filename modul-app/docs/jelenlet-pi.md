# Jelenlét — terminál sync (modul-app)

Per-tenant eszköz + token **csak a platform** Cég részletezőn. Tenant UI-ban nincs eszközkezelés.

**Élő Pi kiosk:** main jelenlét = közvetlen Supabase `attendance_logs` (változatlan).  
**modul-app:** secondary best-effort POST ugyanezzel a `cardId`/`pin`-nel — lépések: `raspberry-pi-attendance/PI_CONNECT_MODUL_DUAL_WRITE.md`.

## Platform

1. Cég → Entitlements → **Jelenlét** add-on be.
2. Ugyanott: **Új eszköz + token** → egyszer megjelenő token.
3. Hardver telepítés (mi) — tenant csak PIN/RFID-t lát a dolgozón.

## Pi env (secondary)

```bash
JELENLET_SCAN_URL=https://app.optinova.hu/api/jelenlet/terminal/scan
JELENLET_SYNC_SECRET=<platformról másolt token>
```

Auth: `Authorization: Bearer <token>` vagy `x-jelenlet-secret: <token>`.

Body — pontosan egy azonosító:

```json
{ "pin": "9616" }
```

vagy

```json
{ "cardId": "8C93E105" }
```

Válasz (201): `employeeName`, `scanType` (`arrival` | `departure`), `workDate`, `arrivalTime`, `departureTime`.

GUI siker/hiba **csak** a main/Supabase úttól függ; modul hiba → külön `modul_pending_scans` queue.

## Tenant UX

| Route | Job |
|---|---|
| `/dolgozok/[id]` | PIN / RFID mezők |
| `/jelenlet` | Naptár (terminál írja is) |

Nincs `/jelenlet/terminalok`.
