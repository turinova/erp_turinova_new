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
  chip: **Elöl a készletes** · **Mennyiség 1|2|5|10|100|1000** (qty-first)
  idle: **Gyors termékek** tile-rács (kurált, max 24)
Jobb: kosár + sticky footer
  Nettó | Fizetendő (nagy)
  [Díj] [Kedv.] · [Készpénz · összeg] [Kártya · összeg] [Vegyes]
<1024: tab **Termékek | Kosár (n)**; pay sticky a kosár panelen
```

**Érintő / tablet (`usePosTouchMode`):**
- Auto: `(pointer: coarse)` vagy `localStorage modul-pos-touch=1` (Több menü → Érintő mód).
- Target ~44–48px (kereső h-12, qty, pay h-16); F4/F5 hint elrejtve.
- Topbar: Ügyfél/Számla látható; Beállítás / KP / Zárás / Visszáru / Kilépés → **Több**.
- Touch kosár: kártya sorok (nem tábla); confirm: nagyobb dialógus + készpénz **numpad**.
- Pay CTA: `Készpénz · 12 450 Ft` (összeg a gombon).

**Kereső (typeahead, nem full-text engine):**
- Match: exact → prefix → contains (név / SKU / barcode / belső barcode); limit ~15.
- `accessories.sellable_pos = true` (default true; form: „Elérhető a POS-on”).
- Soft stock: 0 készlet is listázható; **Elöl a készletes** chip rendez; OOS sor muted + „Nincs készleten”.
- Scan (Enter) vs gépelés: ugyanaz a ranked lista; barcode exact nyer.
- **Qty-first:** előválasztott mennyiség a következő scan/tile/találat tapre (reset 1-re add után).

**Gyors termékek (kurált rács, nem auto top-seller):**
- Tábla: `pos_quick_items` + `pos_label` (rövid pult-felirat, max 32); migráció `20260533`.
- Idle: text-first **tile** — **3 sor** wrap név + **teljes cikkszám** + méret/RAL chip + ár + készlet; OOS warning border.
- Megjelenő név: manuális `pos_label` → különben **teljes katalógusnév** (3 sor wrap); méret/RAL chip a névből.
- Grid: **2 oszlop**; qty badge; tap flash; empty → beállítás CTA.
- Settings: preview + **Pult felirat** (üres = teljes név; rövidítésnél hagyd a méretet) + sorrend.
- Kereső találat: név `line-clamp-2` + SKU + ár + készlet.

Kosár: desktop tábla (név+chip | − qty + | **Bruttó összeg** | ✕); touch: kártyák. Kedvezménynél áthúzott eredeti + új. Díj a Bruttó összeg oszlopban. Expand (desktop): Bruttó egységár + sor-kedv. Confirm: Bruttó részösszeg → Nettó/ÁFA → Fizetendő; touch cash numpad. Készlethiány = warning soft + chip. Scan = success flash.

**Visszáru (S5):** topbar **Visszáru** → eladás kereső → `/ertekesitesek/[id]?return=1`. Részletek: [30](30-visszaru-workflow.md).

**Visszajelzés (POS):** egy inline sáv a topbar alatt (`PosFeedbackBar`).  
Eladás sikerére **nincs toast** (duplikáció tilos). Toast csak mellékhatásra: clipboard (`Másolva`), ügyfél billing hint.

Success sáv: nagy **összeg** + eladásszám · fizetés mód · opcionális számla / AEE hint · auto-dismiss ~5 s.  
Számla fail: egy **warning** sáv (nem error+success egyszerre).

**Beállítások:** topbar → `PosSettingsDialog` (`max-w-3xl`): bal szekciók (Fizetés / Eladás / Gyors termékek / Kártyagép) + `MenuSelect`, plain HU.  
Deep link: `/pos?beallitasok=1` · legacy `/pos/beallitasok` → redirect.

---

## 2. Happy path

```
Scan/keres → kosár → (díj/kedv/ügyfél) → Készpénz | Kártya | Vegyes
→ Confirm (due + KP visszajáró / split)
→ ha van kártya rész: Teya payment-request VAGY kézi megerősítés (pay-then-sale)
→ create_sale(channel=pos, payments[]) → clear + focus
→ success sáv (összeg-first, nincs toast) + AEE hint ha kell
```

Primary confirm: **Eladás rögzítése** (kézi kártyánál: **Sikeres — eladás rögzítése**; Teya: auto rögzítés SUCCESSFUL után).

Copy: badge **Eladás** (nem „Nyugta”); számla esetén **Számla**.

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
| **Később** | Held cart, ePG API, qvik, Teya register OAuth UI, drag-reorder quick grid (nem scope) |

---

## 5. Edge (rövid)

Ismeretlen barcode → inline hiba; soft stock warn; empty cart CTA disabled; RPC fail → kosár megmarad; success → clear + refocus; Teya/manual cancel → nincs sale.

Migráció: `20260524_alap_includes_pos_labels.sql` (Alap); `20260529_pos_terminal_settings.sql` (Teya settings); `20260530_pos_settings_policies.sql`; `20260531_accessory_sellable_pos.sql` (`sellable_pos`); `20260532_pos_quick_items.sql` (gyorsrács); `20260533_pos_quick_label.sql` (`pos_label`). Korábbi: `20260517`, `20260511_pos_page.sql`.
