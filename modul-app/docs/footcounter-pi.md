# Belépők — Pi sync (modul-app)

Per-tenant eszköz + token a **platform** Cég részletezőn. Nincs globális `FOOTCOUNTER_SYNC_SECRET` Vercel env.

## Platform

1. Cég → Entitlements → **Belépők** add-on be.
2. Ugyanott: **Új eszköz + token** → egyszer megjelenő token.
3. Opcionális stream URL (MJPEG) az eszközön.

## Pi `config.env`

```bash
FOOTCOUNTER_SYNC_URL=https://<tenant-app-host>/api/footcounter/sync
FOOTCOUNTER_SYNC_SECRET=<platformról másolt token>
FOOTCOUNTER_DEVICE_SLUG=bejarat
```

Auth: `Authorization: Bearer <token>` vagy `x-footcounter-secret: <token>`.

Body példa:

```json
{
  "device_slug": "bejarat",
  "events": [
    {
      "client_event_id": "uuid",
      "occurred_at": "2026-04-29T10:00:00+02:00",
      "direction": "in",
      "confidence": 0.9
    }
  ]
}
```

`client_event_id` idempotens. Max 500 event / request.

## Tenant UI

`/belepok` — mai Be/Ki (Europe/Budapest). Részletes dashboard később.

## Demo seed (Pi nélkül)

Teljes **2026** synthetic crossings (main-app mintázat: H–P ~150–220 belépő, Szerda/Csütörtök csúcs, Szombat gyengébb, Vasárnap zárva):

```bash
cd modul-app
npm run seed:footcounter -- --tenant-slug=demo
# vagy
npm run seed:footcounter -- --tenant-id=<uuid> --replace
npm run seed:footcounter -- --tenant-slug=demo --dry-run   # csak stat
```

A script létrehozza a `bejarat` eszközt, bekapcsolja a Belépők add-ont, és upserteli a `footcounter_crossings` sorokat.
