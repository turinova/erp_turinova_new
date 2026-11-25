# 64 — Kézi rendelések és kézi várólista

Beszerzés nélküli, egyszerűsített bolti rendelési modul (első ügyfél: Hírös Ablak). Entitlement-kapuzott: `product_features` `/kezi-rendelesek`, `/kezi-varolista`.

## Határok

- Saját táblák: `manual_orders`, `manual_order_items`, `manual_order_deposits`, `manual_order_events` (migráció `20261023_manual_orders.sql`).
- Közös: `customers`, `accessories` (katalógus), `suppliers`, SMS ledger (`sms_send_events.manual_order_id`, sablon `manual_order_ready`).
- **Nem** nyúl: CSO (`ugyfelrendelesek`), PO, készletmozgás, eladás, POS, címkenyomtatás. A modul kikapcsolható a beszerzési lánc érintése nélkül.

## Állapotok

Tétel: `nyitott → megrendelve → megerkezett → atadva` (+ `torolve`). A fej státusza a tételekből számolódik (trigger `recompute_manual_order_status`). Váltás csak az `manual_order_items_set_status` RPC-n át — ez bélyegez (`*_at`, `*_by_label`) és naplóz.

Következő lépés (fix szabály, `moNextAction`): Nyitott → Megrendelve → Megjött → Átadás.

## Képernyők

| Útvonal | Layout |
| --- | --- |
| `/kezi-rendelesek` | Lista: státusz chipek számmal, keresés (URL), 25/oldal, „Új rendelés” jobbra fent. |
| `/kezi-rendelesek/uj` | 9+3: bal Vevő + Tételek (egy kereső: katalógus vagy szabad tétel), jobb sticky összesítő + előleg. Alsó sticky `FormActionBar`: Mégse · Mentés, már megrendeltem · **Mentés** (Ctrl/⌘+Enter). Beszállító minden tételen kötelező. |
| `/kezi-rendelesek/[id]` | Lapszabászat quote minta: fejléc + stepper; bal 9: vevő/rendelés kártyák, tételtábla kijelöléssel; jobb 3 sticky: `DueAmountCard` (Átvételkor fizet), Műveletek (1 primary = következő lépés, a többi secondary, letiltva + látható ok), Info. Alul teljes szélességben: Előleg és befizetések (`#elolegek`), Értesítések, Napló. Mobilon `DueAmountBar`. |
| `/kezi-varolista` | Nézet chipek (Megrendelni / Úton / Átvehető │ Átadva / Törölve / Mind), keresés + beszállító szűrő, beszállítónként csoport „Rendelési szöveg” + „Mind …” gombbal. Kijelöléskor alsó sticky sáv: műveletek `n/összes` érvényes darabszámmal. |
| `/kereso` | „Kézi rendelések” találati csoport a termékek felett, „Átadás” ablak (csak megjött tételek). |

## Ablakok (`manual-order-dialogs.tsx`)

- **Megjött + SMS:** érintett vevők előjelölve (mobil nélkül nem jelölhető), részleges érkezés `x/y` jelölve, előnézet. Gombok: Mégse · Csak megjött, SMS nélkül · **Megjött + N SMS**.
- **Rendelési szöveg:** beszállítónként szerkeszthető blokk + Másolás; bezáráskor opcionálisan a nyitott tételek „Megrendelve”.
- **Átadás:** megjött tételek előjelölve, előleg emlékeztető. Fizetés a kasszán történik.

## Bekapcsolás

Add-on `kezi_rendelesek` (`product_addons` + `product_addon_features`: `kezi_rendelesek`, `/kezi-rendelesek`, `/kezi-varolista`). Platform admin → tenant → Add-onok → Bekapcsolás / Kikapcsolás. Kikapcsolva: menü eltűnik, a layout guard 404/redirect, a server actionök (`requireMoContext`) elutasítanak, a kereső nem mutatja a csoportot. Az adatok megmaradnak.

Usernkénti hozzáférés: Beállítások → Jogosultságok (`APP_PAGES`, Ügyfél kategória). Owner/admin üres page_access mellett automatikusan lát.
