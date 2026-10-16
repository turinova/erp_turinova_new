# 29 — POS workflow (`/pos`)

**Státusz:** S2 P0+P1 + tender/terminál (split, Teya/manual, shortcut).  
**Route:** `/pos` · műszakok: `/ertekesitesek/muszakok` · terminál: in-POS dialógus (`?beallitasok=1`)  
**Csomag:** **Alap plan** (39 990 Ft nettó/hó) — [33](33-packages-and-addons.md)  
**Kapcsolat:** [28-ertekesites-workflow.md](28-ertekesites-workflow.md), [31-pos-muszakzaras.md](31-pos-muszakzaras.md)  
**Legacy ötlet:** main-app `PosClient` (viselkedés, nem kód).

---

## 0. Egy mondat

> A POS = vonalkód-first pulti munkaasztal → ugyanaz a `sales_orders` mag (`channel=pos`) + azonnali fizetés + stock out.

**Nem** a manuális `/ertekesitesek/uj` (az admin űrlap — szintén Alap).  
**Nem** unpaid/utalás (az később a manuális eladáson).  
**Nem** adóügyi e-pénztárgép / AEE — a hivatalos nyugta az **online pénztárgépen** készül. Az Optinova eladás = készlet + műszak + opcionális számla.

Entitlement: capability `pos` + page `/pos` + `/pos/beallitasok` + `/ertekesitesek/muszakok` (migráció: `20260524_alap_includes_pos_labels.sql`, `20260529_pos_terminal_settings.sql`).

---

## Layout

```
Fullscreen · 50/50 (≥1024)
Bal: kereső/scanner (tábla: Termék | Készlet | Bruttó egységár)
  chip: **Elöl a készletes** (qty mindig 1 scan/kattintáskor; módosítás a kosárban)
  idle: **Gyors termékek** tile-rács (kurált, max 24)
Jobb: kosár toolbar — **PDA** · Félrerak · Ürítés · **Visszáru** · (Visszahív) · **Több**
  (affordance: PDA badge/info soft ha van handoff; Ürítés danger-soft; Visszáru info-soft; Díj `CirclePlus` + Kedv. warning-soft a totals mellett — Pay marad az egyetlen heavy primary)
  sticky footer: totals · pay [KP] [Kártya] [⇄]
  **Nincs eladó topbar** — max magasság a katalógusnak
<1024: tab **Termékek | Kosár (n) | Több**; pay sticky a kosár panelen
```

**Érintő / tablet (`usePosTouchMode`):**
- Auto: `(pointer: coarse)` vagy `localStorage modul-pos-touch=1` (Több → Érintő mód).
- Target ~44–48px (kereső h-12, pay h-16); F4/F5 hint elrejtve.
- Nincs Checkout topbar. **Visszáru** a kosár fejen (park warn ha van kosár). **Több**: cél, WH/pénztár ha >1, Új termék, KP, Zárás, Érintő, Kilépés. Gate: WH/pénztár.
- Touch kosár: kártya sorok (nem tábla); confirm: nagyobb dialógus + készpénz **numpad**.
- Pay CTA: `Készpénz · 12 450 Ft` / `Kártya · …` egy sorban; Vegyes csak `⇄` ikon (`min-w-12`, title/aria).

**Kereső (typeahead, nem full-text engine):**
- RPC: `search_pos_products` (`20260596` compact): **spaced token-ALL** *vagy* **compact contains** (egybeírt `korpuszösszehúzó` ↔ `Korpusz összehúzó`).
- Gather: 1. token ILIKE + hosszú egybeírt **prefix** (6–7 char) + trgm; Pass2 soft; Pass3 fuzzy (compact, thr ~0.28).
- Mezők: név / SKU / barcode / belső barcode / MPN / brand / gyártó / `web_search_aliases`; limit ~15.
- **Pultkatalógus:** `sellable_pos` (default **false**; barcode/internal → backfill/szinkron true). Form: „Elérhető a POS-on”.
- Opcionális POS setting: **Keresőben csak vonalkódos** (`search_barcode_only`, default ki) — typeahead tovább szűkít.
- Szinkron gomb (POS beállítások): `sync_sellable_pos_from_barcodes` — migráció `20260597`.
- Soft stock: 0 készlet is listázható; **Elöl a készletes** chip rendez; OOS sor muted + „Nincs készleten”.
- **Gépelés:** mindig ranked lista (debounce) — soha auto exact-scan / mezőtörlés; üres LRU nem cache-el zero-hitet. Pure digit stub (1–3) **nem** hív RPC-t; materials csak `q.length ≥ 4`. API: lean auth + middleware skip + `Server-Timing`.
- Zero-hit UI: tippek (szóköz, SKU, POS-eladható, alias) + **Gyors felvétel** + Keresőszavak.
- Miss telemetria: `pos_search_events` → manager **POS használat** top miss lista (`pos_search_miss_stats`).
- **Exact barcode:** wedge (`BarcodeWedgeTrap`, gap **90 ms**, `e.code` HU Digit0/Minus) vagy Enter; miss → **PosMissProductDialog** + **Beolvasva** monoszpace kód. Match: `barcodeLookupCandidates` (normalize ö/ü, **Y↔Z**, hyphen-compact) → RPC `lookup_pos_barcode` (`20260610` compact + sku); hygiene `20260605`.
- **SKU gépelés (4–12 digit):** typeahead **+** parallel exact lookup (ne üres lista). EAN-13 / alfanumerikus CODE128 (`DT-CZ…`): exact preview, nem fuzzy.
- **Barcode hot path (perf):** `/api/pos/barcode-lookup` = **lean staff auth** (`resolvePosLeanAuth`) + middleware skip + `Server-Timing` — **nem** nyúl a typeahead `/api/pos/search`-hez (SKU gépelésnél parallel hívás OK). Session LRU + single-flight + optimistic kosár (cache hit); stale/miss → rollback. PDA ugyanaz. Migráció: `20260610`.
- **Mount bootstrap (perf):** hydrate után `GET /api/pos/bootstrap?include=shift,catalog,chips` (blocking), majd soft `include=progress`. Typeahead/sale/invoice érintetlen. Settings → `include=catalog`. PDA handoff poll külön.
- **Gyors felvétel / Új termék:** Több → **Új termék** (+ miss/zero-hit CTA). Mezők: név, vonalkód (+ **Generálás**, nem ír SKU-t), ÁFA, (egység csak ha több van), opcionális beszerzés+szorzó, bruttó. SKU a szerveren auto. → `sellable_pos=true`, kosár (`20260598`). Beírt bruttó → `accessories.price_gross` (polcár; ÁFA round-trip, pl. 4000 Ft @ 27% ne legyen 4001) — `20260599`.
- **Hozzárendelés:** keres a teljes aktív katalógusban (nem csak POS) → üres `barcode` vagy `barcode_internal` + `sellable_pos=true`.
- Törzsadat: **Belső vonalkód → Generálás** (ugyanaz az EAN-13 allokátor).
- **Anyag (lapszab):** kereső chip Mind/Termék/Tábla/Szálas; **név-only** ILIKE (nincs gyártó). Tábla gépkód: `machine_code` **prefix**. **Mind + pontosan 3 jegy** (`312`) → csak tábla (rövid stub). **Mind + ≥4 digit** (SKU pl. `1277`) → **termék typeahead + anyag** együtt — chip csak szűr, nem cserél nyelvet (`search-policy.ts`). Enter: barcode/SKU always exact (`shouldRunBarcodeEnter`); 3 jegyű stub → lista pick. Exact hit + `q.length > 5` → Odoo-style fuzzy suppress. Qty dialógus: **m²|tábla** / **m|szál** toggle; kosár canonical **m²/m**; soft OOS; stock out fulfillkor (`20260577`).
- Policy unit: `npm run test:pos-search-policy` · Golden: `node --env-file=.env.local scripts/golden-test-pos-search.mjs`

**Gyors termékek (kurált rács, nem auto top-seller):**
- Tábla: `pos_quick_items` + `pos_label` (rövid pult-felirat, max 32); migráció `20260533`.
- Idle: text-first **tile** — **3 sor** wrap név + **teljes cikkszám** + méret/RAL chip + ár + készlet; OOS warning border.
- Megjelenő név: manuális `pos_label` → különben **teljes katalógusnév** (3 sor wrap); méret/RAL chip a névből.
- Grid: **2 oszlop**; tap flash; empty → beállítás CTA.
- Settings: preview + **Pult felirat** (üres = teljes név; rövidítésnél hagyd a méretet) + sorrend.
- Kereső találat: név `line-clamp-2` + SKU + ár + készlet.

Kosár: desktop tábla (név+chip | − qty + | **Bruttó összeg** + alatta kis **egységár** `Ft / egység` | ✕); touch: kártyák, ugyanez az összeg alatt. Kedvezménynél áthúzott eredeti + új; egységár listaár (+ −%). Díj a Bruttó összeg oszlopban. Expand (desktop): Bruttó egységár szerkesztő + sor-kedv. Confirm: Bruttó részösszeg → Nettó/ÁFA → Fizetendő; touch cash numpad. Készlethiány = warning soft + chip. Scan = success flash.

**Parkolt kosár (1 slot, sessionStorage `modul-pos-held-v1`):** kosár fejléc **Félrerak** / **Ürítés** / (ha van) **Visszahív** + **Parkolt törlése**. Max 1 parkolt / pénztár; második park tiltva amíg vissza nem hívod vagy törlöd. Üres aktív kosárra visszahív azonnal; nem üresre Confirm (felülír). Műszakzárás törli a parkoltat (előtte warn). Eladás siker → csak az aktív kosár ürül (parkolt megmarad).

**Visszáru (S5):** kosár **Visszáru** → termék barcode/név + dátum chip → eladások a termékkel → wizard a POS-on (nem ERP). Haladó: eladás szám / ügyfél. Nyitott kosárnál: park ajánlat. Részletek: [30](30-visszaru-workflow.md).

**KP mozgás:** Több → **KP feladás** (`out`) / **KP betét** (`in`) → `PosShiftCashMoveDialog` → toast.

**Visszajelzés (POS):** egy inline sáv a topbar alatt (`PosFeedbackBar`).  
Eladás sikerére **nincs toast** (duplikáció tilos). Toast mellékhatásra: clipboard, ügyfél billing hint, park/visszahív, KP mozgás.

Success sáv: nagy **összeg** + eladásszám · fizetés mód · opcionális számla / AEE hint · auto-dismiss ~5 s.  
Számla fail: egy **warning** sáv (nem error+success egyszerre).

**Beállítások:** Több → `PosSettingsDialog` (`max-w-3xl`): Fizetés / Eladás / Gyors termékek / Keresőszavak / Kártyagép.  
Eladás: számla + ügyfél = **fizetés ablak** (confirm); nincs „Alapértelmezett fizetés” UI (holt).  
Deep link: `/pos?beallitasok=1` · legacy `/pos/beallitasok` → redirect.

---

## 2. Happy path

```
Scan/keres → kosár → Készpénz | Kártya | Vegyes
→ Confirm: Vevő (default Vendég) · opcionális „Számlát kérek” + billing · due / KP
→ ha van kártya rész: Teya / kézi → create_sale → clear + focus
→ success sáv (összeg-first) + AEE hint ha kell
```

Primary confirm: **Eladás rögzítése**. Ügyfél / számla a **confirmban** (Square Charge), nem a topbaron. `require_customer` / üres billing → confirm validáció.

Copy: badge **Eladás**; számla esetén **Számla**.

**Gyorsbillentyűk (nem touch):** F2 kereső · F4 készpénz · F5 kártya · `+`/`−` utolsó sor qty (nem input fókuszban).

---

## 3. Fizetés / terminál

| Mód | Viselkedés |
|---|---|
| Készpénz | Magyar 5 Ft kerekítés a teljes due-ra · kapott → visszajáró |
| Kártya | Teya POSLink Off-Device (`/poslink/v3/payment-requests`) vagy kézi megerősítés |
| Vegyes | KP rész + kártya rész = bruttó due (nincs order-level cash round) · KP visszajáró · majd terminál a kártya összegre |

Terminál fajta: `teya` | `manual` (localStorage `modul-pos-card-terminal`; SoftPOS eltávolítva).  
Beállítás: `tenant_pos_settings` (tender / stock / kedvezmény / számla / Teya) + pénztár override (`pos_registers.teya_*`) · UI: `PosSettingsDialog`.

Teya flow: OAuth M2M → create payment-request (register terminal override) → poll → `SUCCESSFUL` → sale.

Policy (P0): allow_cash/card/split · stock_policy warn|block · max_discount_percent · show_invoice · require_customer.

---

## 4. Fázisok

| | Scope |
|---|---|
| **P0+P1** | Shell, cart, search, barcode, pay sheet, session — **kész** |
| **Tender** | Split, visszajáró, Teya/manual, shortcut, AEE hint — **kész** |
| **Clerk UX** | Held cart (1 slot), kosár ürítés, in-POS return `from=pos`, KP betét — **kész** |
| **Később** | ePG API, qvik, Teya register OAuth UI, drag-reorder quick grid, multi held (nem scope) |

---

## 5. Edge (rövid)

Ismeretlen barcode → miss dialógus (vagy flash ha gyors felvétel ki); soft stock warn; empty cart CTA disabled; RPC fail → kosár megmarad; success → clear + refocus; Teya/manual cancel → nincs sale.

Migráció: `20260524_alap_includes_pos_labels.sql` (Alap); `20260529_pos_terminal_settings.sql` (Teya settings); `20260530_pos_settings_policies.sql`; `20260531_accessory_sellable_pos.sql` (`sellable_pos`); `20260532_pos_quick_items.sql` (gyorsrács); `20260533_pos_quick_label.sql` (`pos_label`); `20260597` (barcode gate); `20260598` (`allow_pos_quick_create`). Korábbi: `20260517`, `20260511_pos_page.sql`.
