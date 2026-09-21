# 33 — Csomagok és add-onok

**Állapot:** 2026-09-21 — Alap 39 990, 2 hónap próba, éves 399 900; belépő 5 000.  
**Migráció:** `20260524_alap_includes_pos_labels.sql`, `20260525_footcounter_price_5000.sql`

Kapcsolódó: [21-platform-ops.md](21-platform-ops.md), [23-lapszabaszat-addon.md](23-lapszabaszat-addon.md), [24-beszerzes-workflow.md](24-beszerzes-workflow.md), [29-pos-workflow.md](29-pos-workflow.md).

---

## Alap plan (39 990 Ft nettó / hó)

**Próba:** 2 hónap automata, díjmentes.  
**Éves:** 399 900 Ft (10× havi — 2 hónap ajándék).

Bolt mag — **nem** opcionális:

| Terület | Route / feature |
|---|---|
| Értékesítések + árajánlat | `/ertekesitesek`, `/ertekesitesek/arajanlatok` |
| Készlet / raktár / átadás | `/raktarak`, mozgások |
| Beszerzés | `beszerzes` + `/beszallitok`, rendelés, beérkezés |
| POS terminál + műszakok | `pos`, `/pos`, `/ertekesitesek/muszakok` |
| Termék címkenyomtatás | `product_labels` |
| Törzsadat, ügyfél, kereső | Alap oldalak |

**Nincs** a planben: Lapszabászat, partner portál, SMS, jelenlét, belépőszámláló.

---

## Add-onok

| Key | Ár (nettó/hó) | Mit ad |
|---|---|---|
| `lapszabaszat` | **10 000** | Opti / ajánlat / anyag stack ([23](23-lapszabaszat-addon.md)) |
| `jelenlet` | **9 900** | Manuális ív; opcionális chipkártya hardver (egyszeri) |
| `partner_orders` | 19 000 | Partner portál |
| `quote_ready_sms` | 4 900 + 89 Ft/db | SMS |
| `footcounter` | **5 000** + kamera egyszeri | AI belépőszámláló |

**Kikapcsolt katalógus:** `beszerzes`, `pos`, `product_labels` (`active=false`) — feature az Alap planra került.

---

## Platform

- Add-on ki/be: platform tenant detail → `setTenantAddon` → `materializeTenantEntitlements`.
- Plan váltáskor / új tenantnál: ha a plan tartalmazza a POS-t → `grantPosPageAccess`.
- Tenant UI: nincs self-serve switch ([21](21-platform-ops.md)).

---

## Backfill (20260524)

- Minden Alap-tenant: `pos`, `/pos`, műszakok, `product_labels` entitlement + POS page_access.
- `pos` / `product_labels` tenant_addons sorok törölve (díj az Alapban).
