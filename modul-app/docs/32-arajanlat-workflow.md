# 32 — Termék árajánlat (sales quote)

**Státusz:** Q0–Q2 (billing + draft tételek + PDF + törlés).  
**Route:** `/ertekesitesek/arajanlatok`, `/ertekesitesek/arajanlatok/[id]`, `/ertekesitesek/arajanlatok/[id]/szerkeszt`  
**Migráció:** `20260515_sales_quotes.sql`, `20260516_sales_quote_billing_snapshots.sql`, `20260577_sale_material_lines.sql`, **`20260586_sales_quote_draft_lines_pdf.sql`**  
**Kapcsolat:** [28](28-ertekesites-workflow.md) — **nem** a lapszabászat [23](23-lapszabaszat-addon.md) / `/ajanlatok`

---

## 0. Egy mondat

> Termék árajánlat = papír az ügyfélnek (nincs készletmozgás). Draft = élő kosár. Sent = zárolt. PDF mindig. Elfogadás után **Eladás** (`create_sale`), billing az ajánlat snapshotjából.

**Teljesen külön** a lapszabászati `/ajanlatok` + `/megrendelesek` pipeline-tól.

---

## 1. Fogalmak

| UI | DB |
|---|---|
| Árajánlat | `sales_quotes` |
| Tétel / díj | `sales_quote_items` |
| Számlázás (doksi) | `billing_*_snapshot` |
| Eladás | convert → `sales_orders` (`converted_sale_id`) |
| Másolat / revízió | `cloned_from_id` |

---

## 2. Státusz + szerkesztés

`draft` → `sent` → `accepted` (convert) · `lost` · `expired` · `cancelled`

| Státusz | Tétel/ár | Header | Convert |
|---|---|---|---|
| `draft` | **`/szerkeszt`** + `replace_sales_quote_draft_lines` | PDF · Tételek · Kiküldve · Eladás · Törlés | igen |
| `sent` | tilt → **Másolat** | PDF · Eladás · Másolat · Elveszett · Törlés | igen |
| `accepted` / lezárt | tilt | PDF · Eladás megnyitása · Másolat | nem |

- Sent után élő módosítás **tilos** — Másolat új draftba.  
- `valid_until < today` → auto `expired` (lista/detail olvasáskor, `expire_sales_quotes_past_due`).  
- Convert: teljes fizetés **vagy** utalás (üres payments → confirmed unpaid).  
- Orphan edge: ha `mark_sales_quote_converted` fail → toast + eladás link.

---

## 3. Számlázás (big-brand)

1. Ügyfél → billing másolódik az ajánlatra.  
2. Draft szerkesztés: felülírható csak az ajánlaton.  
3. Detail a snapshotot mutatja.  
4. Opcionális: Mentés az ügyfél törzsbe.  
5. Convert: snapshot → sale billing.

---

## 4. UX (certainty)

- Create ≈ manuális eladás, fizetés nélkül. Primary: **Ajánlat mentése**.  
- Detail: egy fő CTA státusz szerint (Eladás / Eladás megnyitása); PDF secondary.  
- Draft tételek: `/szerkeszt` (kosár: hozzáad / qty / ár / törlés).  
- PDF: `/api/ertekesitesek/arajanlatok/[id]/pdf` — vizuális shell 1:1 a lapszabászat ajánlat PDF-fel (`lib/pdf/quote-document-shell.ts`: tenant logo, Turinova footer, summary tábla, 8/4 mm margin). Puppeteer temp: `modul-app/.tmp/puppeteer`.  
- Lista default: **Aktív** (draft+sent).

---

## 5. Edge

Üres kosár tilt · ügyfél kötelező · lejárt convert tilt · dupla convert tilt · clone kihagyja a törölt SKU-kat · fee_type_id megőrzés clone/convert · soft stock a create_sale-nél.
