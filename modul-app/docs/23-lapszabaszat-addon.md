# Lapszabászat add-on

Opti / ajánlat / megrendelés / anyag / gép stack — **nem** része az Alap plannak.

| | |
|---|---|
| Key | `lapszabaszat` |
| Ár | **10 000 Ft / hó** nettó |
| Migration | `20260430_lapszabaszat_addon.sql`, `20260922_lapszabaszat_includes_partner_sms.sql` |

## Mit nyit

- `/opti`, `/ajanlatok`, `/megrendelesek`, `/scanner`
- Táblás / szálas / élzárók
- Gyártógépek, berendezés
- Opti beállítások
- **Átvételi blokk** (hőnyomtató elismervény — [43](43-atveteli-blokk.md))

**Nem** része: ügyfelek, gyártók, termékek, média, Belépők.

## A csomag részei

| Add-on | Szabály |
|---|---|
| `partner_orders` | A Lapszabászattal automatikusan bekapcsol; külön havidíja nincs |
| `quote_ready_sms` | A Lapszabászattal automatikusan bekapcsol; 89 Ft nettó / kiküldött SMS |

Lapszabászat kikapcsolásakor ezek is automatikusan kikapcsolódnak.

## Nav

Sidebar **Lapszabászat** csoport: Árajánlatok, Megrendelések.
Opti és Scanner top-level menüpontok maradnak (entitlement továbbra is a Lapszabászat add-onhoz kötött).

**Workflow (státusz + detail CTA):** [37-lapszabaszat-quote-workflow.md](37-lapszabaszat-quote-workflow.md).  
**Opti panel import (tervezet):** [47-opti-panel-import.md](47-opti-panel-import.md) — szöveg / Excel / kép, Korpus élkódolás, certainty-first előnézet.

### Opti billentyű (műhely)

| Billentyű | Hatás |
|---|---|
| **Enter** méret / darab / jelölés / pánthely / zárt él-select | Panel hozzáadása (vagy mentés szerkesztéskor) |
| **Space** / **↓** / katt él-selecten | Lista nyitás |
| **Enter** nyitott él-listában | Élzáró kiválasztása (nem ment panel) |
| **X** / **Delete** / **Backspace** zárt él-selecten | Él ürítése (marad a mezőn) |
| Él választás után | Fókusz a következő üres élre (felső→alsó→bal→jobb), majd Add |
| **Ctrl/⌘+Enter** | Optimalizálás (ha van panel; sticky sáv gomb) |

**Élzáró „Most”:** az utoljára választott élzáró a többi él-select listáján felül („Most” csoport) — Enterrel gyorsan ugyanaz az él másik oldalra.

### Opti táblás anyagkereső

Async typeahead (`/api/opti/sheet-materials` → `search_sheet_materials_for_opti`): **csak** `sheet_materials.name` + `machine_code` ILIKE (gyártó nem keresési feltétel). Migráció: `20260631_search_sheet_materials_opti_machine_code.sql`.

### Opti ügyfélkereső — kedvencek

`customers.is_favorite` (tenant-szintű). `search_customers_for_select` + lista seed: kedvencek előrébb, label `★ Név`. Kapcsoló: `/ugyfelek` lista csillag + űrlap Switch. Migráció: `20260632_customers_is_favorite.sql`.
