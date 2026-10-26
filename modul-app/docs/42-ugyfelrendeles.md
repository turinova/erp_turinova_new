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
| `/ugyfelrendelesek/uj` | Mentés · `?accessory=` POS deep-link |
| `/ugyfelrendelesek/[id]` | Értékesítés-szerű layout: header meta · Következő · Ügyfél/Rendelés InfoCard · megjegyzés · tételek+összegzés+**Rendelés útja** timeline |
| `/ugyfelrendelesek/varolista` | Napi munka; `?notify=pending` = SMS nélküli átvehetők; **Megj.** ikon (fej+tétel note tooltip); rendelés megnyitás = UR# link (nincs külön Rendelés oszlop) |

### Certainty-first

- Részleten mindig egy **Következő lépés** sáv (lead / PO küldés / bevételezés / átadás) — **egy** primary CTA. **SMS soha nem kapu:** átvehetőnél primary = átadás; SMS secondary / Emellett (`suggestSms`). Urgent (`handover` / `blocked`): `warning-soft`; info (`lead` / PO / bevételezés): `bg-subtle`.
- Header rövid meta (ügyfél · felvéve); részletek a Rendelés InfoCardon. ⋯ Műveletek = ritka (lemondás / SMS újraküldés / restore) — nincs „Adatok szerkesztése” (az a kártyákon van).
- **Vegyes státusz:** ha pl. van úton lévő tétel *és* még listázható / hiányos `felveve`, a sáv **Emellett:** másodlagos sort mutat (secondary gomb: Listára / Pótold a hiányt). Preferencia: leadable > blocked.
- **Blocked:** primary „Tétel javítása” / „Válassz beszállítót” → tétel szerkesztő (`focusItemId`).
- **Megjegyzés:** részleten fej-note callout a Következő lépés *előtt* (teljes szöveg); várólistán StickyNote + tooltip (fej és/vagy tétel).
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
