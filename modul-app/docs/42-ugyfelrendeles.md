# 42 — Ügyfélrendelés

**Állapot:** 2026-09-29 — V1 + várólista + certainty-first következő lépés.  
**Migráció:** `supabase/migrations/20260559_customer_special_orders.sql` (+ `20260560`–`20260564`)  
**Kapcsolódó:** [24-beszerzes-workflow.md](24-beszerzes-workflow.md), [26-beerkezesek.md](26-beerkezesek.md), [33-packages-and-addons.md](33-packages-and-addons.md).

## Cél

Ami **nincs a polcon**: pulton felvesszük → beszállítótól megrendeljük → megérkezik → ügyfélnek átadjuk.  
Nem POS, nem webshop rendelés — külön domain (`customer_special_orders`).

## Státuszok (tétel)

`felveve` → `rendelve` → `itt_van` (UI: **Átvehető**) → `atadva` (+ `torolve`)

A tételsor badge a PO állapotot is beleszövi:

| Badge | Jelentés |
|---|---|
| Listán (vázlat) | Rákerült a PO-ra, még nem ment el |
| Beszállítónál | PO elküldve |
| Részben megjött | PO partial — „2/5 megjött” hint |
| Átvehető | `itt_van` |

Fej státusz = leghátrább élő tétel (DB trigger). Részleges átadás OK.

## UI

| Route | Primary CTA / szerep |
|---|---|
| `/ugyfelrendelesek` | Új ügyfélrendelés — rendelésfej lista |
| `/ugyfelrendelesek/uj` | Mentés · `?accessory=` POS deep-link |
| `/ugyfelrendelesek/[id]` | **Következő lépés** sáv + állapot szerinti CTA |
| `/ugyfelrendelesek/varolista` | Napi munka; `?notify=pending` = SMS nélküli átvehetők |

### Certainty-first

- Részleten mindig egy **Következő lépés** sáv (lead / PO küldés / bevételezés / SMS / átadás).
- Kézi „Megérkezett” = **kivétel** (ghost); preferált: Beérkezések.
- Átadás dialógus: fizetés checklist (POS/nyugta külön).
- POS kereső: nincs készleten → **Ügyfélrendelés** link.

### Várólista nézetek (URL `?view=`)

| view | Státusz | Alap |
|---|---|---|
| `todo` | felveve | igen |
| `on_way` | rendelve | |
| `ready` | itt_van (+ opcionális `notify=pending`) | |
| `done` | atadva | |
| `cancelled` | torolve | |

Szerveroldali lapozás (limit 25). Nincs szabad státuszflip — csak státuszgép szerinti tömeges műveletek.

**Beszállítói listára:** több UR tétele is mehet egyszerre. Dialógus: ha a beszállítónak van **ugyanarra a raktárra** nyitott (`draft`) PO-ja → választás *Hozzáadás a meglévőhöz* (alap, ha 1 db) vagy *Új vázlat*. `ordered` PO-hoz nem append. A beszállítónak küldés külön lépés a PO oldalon.

## Integráció

1. **Beszállítói listára** — lead → draft/új PO vázlat; kötelező PO-link. A beszállítónak még nem megy el (az a Beszállítói rendelések oldalon).
2. **Beérkezés** — sync → `itt_van` + foglalás. SMS **nem** auto.
3. **Kézi „Megérkezett”** — kivétel (polc / nincs PO).
4. **Átadás** — `itt_van` → `atadva` + stock out; fizetés checklist UI.
5. **SMS** — `cso_ready` sablon + dialógus + ledger (platform számlálás).

## Entitlement

Feature: `customer_special_orders` · page: `/ugyfelrendelesek` · Alap plan + office template.

## Explicit nem V1

- POS kosár „collect later” egy tranzakcióban (csak deep-link üres készletből)  
- Drop ship / soft waitlist  
- Legacy `shop_orders` import  
- Nyugta / POS átadás egy gombban  
- Silent auto-append / `ordered` PO-hoz hozzáadás  
