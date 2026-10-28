# 28 — Értékesítés workflow (Sale)

**Státusz:** S1 + S1.5 + billing/díjbekérő UX.  
**Route:** `/ertekesitesek`  
**Migráció:** `20260509` … **`20260528_sale_confirmed_fulfill.sql`**  
**Kapcsolat:** [36](36-szamlazas-workflow.md), web B2C channel: [38](38-agent-commerce.md)

---

## 0. Egy mondat

> Értékesítés = tételek + fizetés + (külön) áruátadás. Utalásnál számlázás kötelező → díjbekérő. Készlet csak teljesítéskor (kivéve „Áru átadva most” / KP).

---

## Boldog utak

| Út | Eredmény |
|---|---|
| KP / kártya | `fulfilled` + paid + stock → opcionális számla |
| Utalás (default) | `confirmed` + unpaid, **nincs** stock → számlázás panel auto → díjbekérő |
| Utalás + áru most | `fulfilled` + unpaid + stock → díjbekérő |
| Fizetés + dijbekérő + confirmed | Áru átadása → végszámla |
| POS + Számlát kér + ügyfél | Billing behúzás → auto számla + „Eladás / PDF” visszajelzés |
| Tábla / munkalap (lapszab) | Eladási qty **m² / m** (1 tizedes); stock out fulfillkor tábla db / szál db\|fm |

**Egység szabály:** eladás / POS / árajánlat → primary m²|m; törzs Készlet kimutatás → primary m²|m + ≈ tábla|db; beszerzés → primary tábla|db (+ ≈ m²|m). Ledger nem változik.

**Migráció anyag:** `20260577_sale_material_lines.sql` (+ `20260575` stock).

---

## Lista (`/ertekesitesek`)

Bolti lookup (bizonyíték-keresés), nem státusz-menedzsment.

| Elem | Viselkedés |
|---|---|
| Layout | **1 toolbar-sor:** kereső + 3× `MenuSelect` (időszak / állapot / csatorna) + darabszám; aktív szűrő chip-ek csak ha ≠ default |
| `q` | `sale_number` + `customer_name_snapshot` + (2+ char) tétel `sku_snapshot` / `name_snapshot`; debounce ~300 ms |
| `q` + státusz | Kereséskor státusz **ignore** (select disabled) — visszáru / cancelled is |
| `period` | `all` \| `today` \| `yesterday` \| `7d` \| `30d` → `created_at` ablak |
| `channel` | `all` \| `pos` \| `manual` \| `webshop` |
| Empty | Szűrő nélkül: „Még nincs…”; szűrővel: „Nincs találat” + törlés |

## Create UX

- **Utalás:** Számlázás panel automatikus; ügyfél / utalásra váltáskor billing behúzás; adószám lookup; submit → `?issue=proforma`.
- **KP:** „Számlát kér” opt-in.
- Primary: utalás+függőben → **Rendelés rögzítése**.

## Detail

Két badge: `status` × `payment_status`.  
**Egy** next-step banner (Díjbekérő → Fizetés → Áru átadása → Végszámla/Számla).  
Header: nincs párhuzamos pénz/számla CTA-halmaz (csak PDF ha van végszámla, visszáru).  
Pénz: `#fizetesek`. Számla: `#bizonylatok` (`resolveInvoiceKindOptions` + `saleInvoiceCtaLabel`; előleg itt).  
Végszámla: csak **paid + nem `confirmed`**. POS paid+fulfilled: csendes detail (nincs utalás-banner).

## Ügyfél

`/ugyfelek` számlázás: `DocumentBillingFields` + taxpayer lookup (üres mezőket tölt).

## POS

Ügyfél választás / „Számlát kér” → billing az ügyfélről. Sikeres számla: zöld sáv (összeg-first) + **PDF / Megnyitás** — **nincs** eladás-toast a pulton.

## Napi zárás (`/ertekesitesek/napi-egyeztetes`)

Square End Drawer + Jobs: egy nap, 3 szám, egy primary.

| Elem | Viselkedés |
|---|---|
| Rendszer | **Külön** (összecsukva): termék `sales_payments` + lapszab `quote_payments`; egyeztetés **összesen** |
| Bolt | 3 stacked sor: Gép szerint / Amit te számoltál / élő Δ |
| UI | Hónap váltó · fő blokk Ma · **Havi elszámolás** kártya (pontosság · járó Ft · napok · streak/hiányzik) · napchip (H–Szo) |
| Elszámolás | OK÷kitöltött + min. 15 nap; ≥90%→**20 e** / ≥95%→**28 e** / fő (UI); üzletvezető külön, nem a képernyőn |
| Progressive | Termék/lapszab + megjegyzés collapsible; eltérésnél megjegyzés auto-nyílik |
| Guard | Mentetlen váltás confirm; nagy Δ warning |
| Küszöb | KP ±2000 · kártya ±1000 vagy 0,5% · utalás ±5000 |
| Mentés | Upsert + snapshot; primary **Zárás mentése** |
| Jog | `20260616_daily_reconciliation_page_access.sql` |
| Home | Motiváló hero widget (`HomeNapiZarasCard`) — mai státusz szín + pontosság + járó Ft + streak → napi zárás |
