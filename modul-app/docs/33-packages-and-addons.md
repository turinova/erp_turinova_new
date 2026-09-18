# 33 — Csomagok és add-onok

**Állapot:** 2026-09-18 tisztítás.  
**Migráció:** `20260517_packages_beszerzes_alap_pos_addon.sql`

Kapcsolódó: [21-platform-ops.md](21-platform-ops.md), [23-lapszabaszat-addon.md](23-lapszabaszat-addon.md), [24-beszerzes-workflow.md](24-beszerzes-workflow.md), [29-pos-workflow.md](29-pos-workflow.md).

---

## Alap plan (22 000 Ft nettó / hó)

Bolt mag — **nem** opcionális:

| Terület | Route / feature |
|---|---|
| Értékesítések + árajánlat | `/ertekesitesek`, `/ertekesitesek/arajanlatok` |
| Készlet / raktár / átadás | `/raktarak`, mozgások |
| Beszerzés | `beszerzes` + `/beszallitok`, rendelés, beérkezés |
| Törzsadat, ügyfél, kereső | Alap oldalak |

**Nincs** a planben: POS terminál, Lapszabászat, partner portál, SMS, címke, belépőszámláló.

---

## Add-onok

| Key | Ár (nettó/hó) | Mit ad |
|---|---|---|
| `pos` | **9 900** | `/pos`, `/ertekesitesek/muszakok`, capability `pos` |
| `jelenlet` | **9 900** | `/jelenlet`, `/dolgozok` — manuális jelenléti ív |
| `lapszabaszat` | (lásd 23) | Opti / ajánlat / anyag stack |
| `partner_orders` | 19 000 | Partner portál |
| `quote_ready_sms` | 4 900 + 89 Ft/db | SMS |
| `product_labels` | 9 900 | Címke |
| `footcounter` | (lásd belépők) | `/belepok` |

**Kikapcsolt katalógus:** `beszerzes` add-on (`active=false`) — feature az Alap planra került.

---

## Platform

- Add-on ki/be: platform tenant detail → `setTenantAddon` → `materializeTenantEntitlements`.
- POS bekapcsoláskor: `grantPosPageAccess` (membership page access).
- Tenant UI: nincs self-serve switch ([21](21-platform-ops.md)).

---

## Backfill (20260517)

- Aki eddig `/pos` entitlementet kapott → automatikus `pos` add-on.
- Új tenant: Alap **nélkül** POS; platform kapcsolja be.
