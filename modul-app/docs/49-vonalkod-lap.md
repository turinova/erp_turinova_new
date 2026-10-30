# 49 — Vonalkód lap (A4 PDF)

Irodai nyomtatóra szánt, menthető **A4 rács** termékvonalkódokkal (füzet / fal). **Nem** Zebra 33×25 ZPL.

## Cél

Boltban sok cikkre nem praktikus hőcímke → dolgozó A4-re nyomtat több kódot, onnan POS / kereső scannel ugyanarra a `barcode` / `barcode_internal` értékre.

## Zárolt döntések

| Téma | Döntés |
|------|--------|
| Route | `/torzsadatok/vonalkod-lap` (+ `/uj`, `/[id]`) |
| Primary output | **PDF** (kliens: JsBarcode → PNG → pdf-lib), mm-pontos A4 |
| Előnézet | ugyanaz a PDF → **PNG** (`pdf.js`); nem CSS mock |
| Cella layout | %-súlyok újraoszlanak az **ON** mezők között; barcode min ~22% |
| Mezők | **cellánként** (show name/sku/price/barcode); sheet switch = új cella default |
| Megjelenített név / ár / egység | `name_snap`, `price_snap`, `unit_snap` — mint címke modal; PDF: `Ft/{unit}` |
| Vonalkód | sharp PNG (integer modul + quiet); min ~10 mm bar; nincs HRI |
| Cella pack | szöveg felül sűrűn (név→SKU→ár), vonalkód a maradék; középre igazított |
| Cella modal | élő JPEG előnézet (print-truth PDF → jpg), mint címke ZPL preview |
| HRI / kódszám szöveg | **soha** nem rajzolódik (csak sávok) |
| Új lap / új cella default | Név ON · SKU OFF · Ár ON · Vonalkód ON |
| Entitlement | meglévő `product_labels` + page key `/torzsadatok/vonalkod-lap` |
| Termékforrás P0 | csak **accessories** (Termékek) |
| 33×25 policy | **nem** alkalmazzuk vakon; külön A4 fit (`print-policy.ts`) |
| Kódpreferencia | érvényes belső EAN-13, ha van; különben gyártói |
| Üres cella | megengedett; PDF kihagyja |
| Dupla termék | megengedett (füzet ismétlés) |
| Snapshot | cellában `barcode_value`, `name_snap`, `sku_snap` — törölt termék PDF-je még megy |
| Margó | default 5 mm (nyomtató soft margin); UI „0” = tipp + kalibráló |
| P0 scope | 1 oldal; preset 3×8 / 4×6 / 2×4 |
| Viewer | lista OK; mentés / PDF write tiltva |

## Nem ez a feature

- ZPL / Browser Print / `printProductLabels`
- Avery matrica kalibráció P0-ban (P1)
- Táblás / szálas anyagok (P1)

## Adatmodell

- `a4_barcode_sheets` — név, cols, rows, margin_mm, show_name / show_sku / show_price
- `a4_barcode_sheet_cells` — row_i, col_i, accessory_id, barcode_value, barcode_source, snapok

RLS: `is_tenant_member` / `can_write_tenant`. Soft delete: `deleted_at` a sheeten.

## UX

- Lista: Új lap · megnyitás · törlés · PDF
- Szerkesztő: A4 **PDF→PNG** előnézet + átlátszó kattintható rács; primary = **PDF letöltése**
- Copy: „Nyomtatás: tényleges méret / 100%”

## Kapcsolódó

- [15](15-print-and-documents.md) §6b
- [33×25 ZPL](15-print-and-documents.md) §6a — külön modul
- Entitlement: `lib/labels/entitlement.ts`
