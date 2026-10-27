# 42 — Ügyfélrendelés

**Állapot:** 2026-10-26 — V1 + várólista + certainty-first + **átadás = értékesítés**.  
**Migráció:** `supabase/migrations/20260559_customer_special_orders.sql` (+ `20260560`–`20260564`, `20260612_cso_sale_links.sql`)  
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
| `/ugyfelrendelesek/uj` | Mentés · `?accessory=` POS deep-link · tételkereső: `/api/cso/product-search` + `search_accessories_page` · előleg a totals sávban |
| `/ugyfelrendelesek/[id]` | Ajánlat-ritmus: breadcrumb · **vízszintes Rendelés útja** · megjegyzés · Következő CTA · Ügyfél/Rendelés · **full-width tételek** · összegzés alul (nincs jobb aside) |
| `/ugyfelrendelesek/varolista` | Napi munka (nav: **Beszerzés** → Beszállítói várólista); `?notify=pending` = SMS nélküli átvehetők; URL változatlan. Ügyfélrendelések lista: top-level az **Ügyfél** szekcióban. |

### Certainty-first

- **Layout (mint `/ajanlatok/[id]`):** header → `CsoJourneyStepper` (vízszintes → chippek + „Következő: …”) → megjegyzés → CTA sáv (body + gombok) → Ügyfél/Rendelés → **full-width tételek** → összegzés. Nincs jobb Műveletek/útja aside.
- CTA sáv: **egy** primary (lead / PO / bevételezés / átadás). **SMS soha nem kapu:** átvehetőnél primary = átadás; SMS = secondary (`suggestSms`); ha már ment → ghost „SMS újraküldése”. Emellett csak lead/blocked. Urgent: `warning-soft`; info: `bg-subtle`.
- Header: breadcrumb „← Ügyfélrendelések” + szám + badge. **Nincs** „Műveletek” overflow. Lemondás = `danger` a **Rendelés** kártyán; lemondott = body sáv.
- **Sor-CTA:** Listára / Átadás csak ha a primary *nem* ugyanaz (`lead` / `handover`) — különben csak Pencil.
- **Vegyes státusz:** **Emellett:** secondary (Listára / Pótold). Preferencia: leadable > blocked.
- **Blocked:** primary → tétel szerkesztő (`focusItemId`).
- **Megjegyzés:** callout a CTA sáv *előtt*; várólistán StickyNote + tooltip.
- Kézi „Megérkezett” = **kivétel** (ghost); preferált: Beérkezések.
- Átadás dialógus: **fizetési mód (alap: KP) + értékesítés**; sikernél toast + „Eladás” link (nincs kötelező redirect).
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
4. **Átadás = értékesítés** — `itt_van` → `create_sale` (KP default / utalás) → stock OUT **csak** sale → `atadva` + linkek. Nincs külön CSO stock out. Részleges átadás = újabb sale. Előleg = discount (első átadáskor). Due=0 / utalás: ügyfél snapshotból biztosítva, ha hiányzik.
5. **SMS (opcionális)** — `cso_ready` sablon; nem blokkolja az átadást. Várólista `?notify=pending` = még nem SMS-ezett átvehetők.  
   Küldéskor `order_share_links` token + `{status_url}` → publikus mobil státusz `/r/{token}` (átvehető / még úton / fizetendő). Lejárat 30 nap.  
   Default SMS rövid: `{order_number} atveheto ({ready_count} tetel). Reszletek: {status_url}` — részletek a linken.

### UI összekötés

| Oldal | Mit lát |
|---|---|
| UR részlet | Eladás szám(ok) link → `/ertekesitesek/[id]` |
| Értékesítések lista | `UR · {order_number}` link a CSO-ra |
| Értékesítés részlet | „Ügyfélrendelés-átadásból” sáv + link |

## Entitlement

Feature: `customer_special_orders` · page: `/ugyfelrendelesek` · Alap plan + office template.

## Explicit nem (még)

- POS kosár „collect later” egy tranzakcióban (csak deep-link üres készletből)  
- Drop ship / soft waitlist  
- Legacy `shop_orders` import  
- Silent auto-append / `ordered` PO-hoz hozzáadás  
- Előleg mint valódi `sales_payments` sor (P2)  
- Átadás közvetlenül a POS UI-ból (manual sale channel)  
