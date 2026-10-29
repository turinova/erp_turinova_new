# 47 — Opti panel import (szöveg / Excel / kép)

**Állapot:** **Szöveg + kép kész** — scope: **csak Szál / Kereszt / Db**. Él és jelölés **nem** importálódik (form aktuális éljei). Excel később.  
**Kapcsolódó:** [23](23-lapszabaszat-addon.md), [37](37-lapszabaszat-quote-workflow.md), [03](03-ux-certainty-first.md), [09](09-keyboard-and-data-entry.md)  
**Kód:** `opti-panel-text-import-dialog`, `panel-text-import.ts`, `parse-panel-image.ts`, `POST /api/opti/parse-panel-image`

## 1. Cél

Műszaki előkészítő gyorsan töltsön be **méretlistát** az Optiba — **úgy, hogy nehéz legyen elrontani**.

```
Import → előnézet (javítható) → „Hozzáadás az Opti listához (N)” → meglévő panels[]
```

Az Opti meglévő listája **nem változik**, amíg a user meg nem erősíti. Optimalizálás **nem** indul magától.

**Importált mezők:** `grainMm`, `crossMm`, `quantity`.  
**Nem importált:** élzárás, jelölés, anyag (anyag = Opti UI választás).

Commitkor: él = form A/B/C/D; jelölés = üres.

---

## 2. Bemenetek

| Bemenet | Scope | Fázis |
|---|---|---|
| Szöveg beillesztés | dim + qty | **kész** |
| Fotó / kép (Anthropic vision) | dim + qty → ugyanaz az előnézet | **kész** |
| Excel / CSV | később | **B** |

### Canonical row

```ts
type ParsedPanelRow = {
  grainMm: number | null
  crossMm: number | null
  quantity: number
  sourceLine: number
  status: 'ok' | 'warn' | 'error'
  issues: string[]
}
```

**Anyag:** kötelező a formon — Import disabled anyag nélkül.

---

## 3. Dim / qty szabályok

- Egész mm, > 0; qty ≥ 1 egész (hiányzik → default **1**).
- Szál/kereszt felcserélés: **nem** auto (user javít előnézetben).
- Max mm túllépés → hiba (anyag alapján).
- Duplikált sorok: megtartjuk.
- Max sor: szöveg **500**, vision **200**.
- Szövegnél `|` utáni él és jelölés token: **ignorálva**.

### Szöveg minták

```
720 560 2
800x400 x4
600;400;1
720 560
```

---

## 4. Kép (Anthropic)

Minta: b2b-portal `parse-order.ts` (forced `tool_choice` + normalize).

| Elem | Érték |
|---|---|
| Modell | `ANTHROPIC_VISION_MODEL` vagy `claude-sonnet-4-6` |
| Kulcs | `ANTHROPIC_API_KEY` (szerver only) |
| API | `POST /api/opti/parse-panel-image` multipart `file` |
| Formátum | JPG / PNG / WebP; max 10 MB; PDF V1 nem |
| Tool | `extract_panel_dims` → grainMm, crossMm, quantity + uncertainty |
| UI | Fotó tab → busy → **ugyanaz** az előnézet + thumbnail |

AI **soha** nem írja a `panels[]`-t közvetlenül. Low confidence / `dimsUncertain` → Figyelem; kézi edit törli az AI note-ot.

Hiányzó API kulcs → 503: *„ANTHROPIC_API_KEY nincs beállítva…”*

---

## 5. UI / UX

### Belépés

Panel felvitele: **Import…** (secondary). Dialógusban: **Szöveg** | **Fotó / kép**.

### Folyamat

```
① Bemenet (textarea VAGY dropzone) → Beolvasás / auto kiolvasás
② Előnézet: # | Szál | Kereszt | Db | Állapot
   filter · hibás kihagyás · (kép: thumbnail + AI warnings)
   Vissza · Hozzáadás az Opti listához (N)
③ Toast + fókusz Szálirány
```

Copy: *„Csak szál, kereszt és darabszám — él a formról jön.”*  
Busy: *„Kiolvassuk a méreteket… Ellenőrizd, mielőtt az Opti listára kerül.”*

---

## 6. Félkész munka (session) + listaürítés

- Új Opti: panelek / megrendelő / projektnév → `sessionStorage` (`modul-opti:v1:{tenant}:{staff|partner}`), **fülélet** (nincs napos TTL). Optimalizálás eredménye nincs sessionben.
- **Lista ürítése** (panel lista fejléc): confirm → panelek + opti eredmény + megrendelő session törlése; anyagválasztás megmarad.
- Árajánlat mentés után ugyanaz a reset — visszatéréskor üres lista (ne jöjjön vissza a régi munka).

## 7. Megmunkálás (duplung + szög + pánthely)

- **Duplungolás:** switch; ON → beírt db ×2 (OFF visszafordítja); flag a panelen; díj Ft/m² (`cutting_fees.duplungolas_fee_per_sqm`, default **0**).
- **Szögvágás:** switch; díj Ft/panel-darab (`szogvagas_fee_per_panel`, default **0**).
- **Pánthelyfúrás:** szám mező (db / panel); **0** = nincs; **2–20**; díj Ft/lyuk (`panthelyfuras_fee_per_hole`, default **0**). Nincs oldal (hosszú/rövid). Díj qty = `lyuk × panel.quantity`.
- Beállítás: `/beallitasok/opti`. Beírt **bruttó** Ft tárolva (`*_gross`); nettó ÁFA-bázis. Opti egységár = tárolt bruttó (nem nettó→bruttó round-trip). ÁFA = vágási díj ÁFÁ-ja. 0 Ft OK.
- Snapshot: `quote_panels` flag/qty + `quote_service_lines` anyagonként.
- Detail / PDF / Számlázz: megmunkálás sor a `quote_service_lines` Ft-jából (DB truth — lásd [13](13-numbers-units-formats.md) §6, [37](37-lapszabaszat-quote-workflow.md) §7).
- Árazás: egész Ft / sor (anyag, él, szabás, megmunkálás); Σ sor = Opti / detail / PDF végösszeg.

Migráció: `20260617_…`, `20260618_opti_panthelyfuras.sql`, `20260619_cutting_fees_gross.sql`.

## 8. Explicit NEM V1

- Él / jelölés import (szöveg és kép)
- PDF multipage
- Classic OCR előfeldolgozás
- Import = auto optimize
- Kliens Anthropic kulcs
- Külön route `/opti/import`
- localStorage / napos TTL a félkész Optira
- Pánthely oldal (hosszú/rövid) / CNC pozíció
