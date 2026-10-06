# ProGate — Shoprenter App Store adatkezelési kiegészítés

Válaszok a Shoprenter follow-up kérdéseire (lekérdezési gyakoriság, partner rendelések, vásárlói adatok).

**App Store scope (amit SR-nek állítunk):** iframe admin (`/sr-embed`) + storefront widget.  
Nem része a bírálati válasznak: teljes merchant portal riport, vevőlista, order-facts, customer-mirror.

**Install flow:** RedirectUri + EntryPoint → `ensureAppStoreShop` (org/shop + OAuth ClientId/Secret + `https://{shop}.myshoprenter.hu`), iframe-ben marad; nincs kézi API kulcs / külön signup. SQL: `042_signup_source_app_store.sql`.

Forrásigazság: `b2b-portal` kód — katalógus job queue (install / manuális), widget search/resolve Postgres tükörből, `/orderExtend?email=`, insights ~10 perc memóriacache.

---

## 1) Lekérdezési gyakoriság (katalógus)

| Esemény | Gyakoriság / trigger | Megjegyzés |
|--------|----------------------|------------|
| Telepítés / bootstrap | **Egyszer**, full sync job | Termékek + kategóriák → Postgres tükör (widget kereső) |
| Periodikus / napi katalógus sync | **Nincs** | Nincs katalógus cron, nincs product webhook |
| Manuális újraszinkron | Igény szerint | Jogosult user indítja; job queue dolgozza fel |
| Ár / készlet a rendelésnél | Élő SR hívás | Resolve után; nem a tükörből |

**Egy mondat (Form):**  
A termékkatológus telepítéskor egyszer full syncel. Nincs periodikus / napi automatikus termékdump. Újraszinkron manuális. Ár és készlet a rendelésnél élő Shoprenter hívásból jön.

---

## 2) Rendelések lekérdezése partnerenként (widget)

| Kérdés | Válasz |
|--------|--------|
| Teljes rendelésállományt húztok, aztán ti szűrtök? | **Nem.** |
| Hogyan? | Shoprenter **`/orderExtend?email=<bejelentkezett partner>`** (`excludeAbandonedCart=1`, `excludeStorno=1`, `full=1`, tipikusan limit 25–30 / page 0) |
| Hol a szűrés? | **Shoprenter oldalon** |
| Mikor? | On-demand (widget insights / újrarendelés), ~10 perc in-memory cache / userId |

**Egy mondat (Form):**  
Nem a teljes bolt rendelésállományát szinkronozzuk. `/orderExtend?email=<partner>` — szűrés nálatok; on-demand, rövid memóriacache.

Kód: `listCustomerOrders` → `/orderExtend?email=` (`src/lib/shoprenter/api.ts`); `getCustomerPurchaseInsights` (`src/lib/purchase-insights.ts`).

---

## 3) Vásárlói / rendelési adatok

### A) Widget insights (on-demand)

| Mit | Mezők | Tárolás | Meddig | Mire |
|-----|-------|---------|--------|------|
| Partner rendeléslista | id, dátum, összeg, státusz, tételszám | Memória + ~10 perc cache | TTL után eldobva | Újrarendelés / javaslatok |
| Tételsorok | SKU, név, qty, ár | Ugyanígy | Ugyanígy | Mennyiség / utolsó rendelés |

Más partner rendelései ezen az úton **nem** érhetők el.

### B) Widget attribution (saját esemény)

| Adat | Cél |
|------|-----|
| partner id + tételek, shop_id | Metering (`b2b_orders`, source=widget) — nem SR order rewrite |

**Retention:** insightshez nincs tartós partner-order archiválás. Attribution a szolgáltatás idejére a tenant DB-ben; uninstall / szerződés szerint.

---

## Belső megjegyzés (nem SR Form szöveg)

- Widget kereső / Excel SKU resolve előszűrő = Postgres tükör. Új termék sync nélkül nem jelenik meg a widgetben.
- Iframe-ben jelenleg nincs „Katalógus frissítése” gomb (csak státusz); manuális resync a teljes portal / platform admin úton.
- Softver backlog (ezen a bírálati körön **nem** építjük be): ütemezett katalógus sync, embed resync, opcionális SR search fallback.

---

## Copy-paste blokk (e-mail / Google Form)

**1. Lekérdezési gyakoriság**  
Telepítéskor egyszeri termék/kategória sync (widget katalógus). Nincs periodikus / napi automatikus full termékdump. Újraszinkron: manuálisan, jogosult felhasználó indítja. Ár és készlet a rendelésnél élő Shoprenter hívásból jön.

**2. Rendelések lekérdezése partnerenként**  
Nem a teljes bolt rendelésállományát húzzuk. Shoprenter `/orderExtend?email=<bejelentkezett partner>` — a szűrés nálatok történik. Csak a widget újrarendelés/insightshez, on-demand, ~10 perc memóriacache.

**3. Vásárlói / rendelési adatok**  
Mezők: rendelés id, dátum, összeg, státusz, tételek (SKU, név, qty, ár). Más partner rendelései ezen az úton nem érhetők el. Insightshez nincs tartós archiválás — feldolgozás + rövid cache. Widget kosár attribution (saját metering) opcionális, nem SR order rewrite.

---

*Utolsó frissítés: 2026-09-15 — App Store scope: iframe + widget; nincs periodikus katalógus sync.*
