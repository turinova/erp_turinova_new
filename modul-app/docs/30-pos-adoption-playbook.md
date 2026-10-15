# 30 — POS adoption playbook (bolt)

Cél: a pultosok **rendszeresen** a modul-app POS-t használják.  
Napi bolt-cél (default): **60 POS eladás**.

## Fázis 0 — emberi bevezetés (kötelező)

1. **1–2 POS mester** / bolt — előre képzés, ők tanítanak.
2. **10 próbatranzakció** üres boltban (scan → kosár → fizetés → zárás).
3. **2 hét hibázási amnesztia** — lassú első napok OK.
4. **Cutover:** új eladás csak POS-on (füzet/Excel tilos, manager kivétel).
5. **Heti 15 perc:** panaszok → 1–2 fix (alias, vonalkód, UI).

## Fázis 1 — mérés

- Oldal: `/ertekesitesek/pos-hasznalat`
- Metrika: `sales_orders` ahol `pos_shift_id` nem null
- Scan mix: `pos_scan_events` (barcode / typeahead / quick…)
- Kereső miss: top zero-hit (`pos_search_miss_stats`, 14 nap) → alias / név javítás
- Pultkatalógus: `sellable_pos` + opcionális „csak vonalkódos” kereső; szinkron gomb
- Miss: **Gyors felvétel** / hozzárendelés (`allow_pos_quick_create`, default be) — `20260598`
- Migráció: `20260593` + `20260596` + `20260597` + `20260598`

## Fázis 2 — micro-liga

- Heti **egy** győztes (manager jelöli) — kávé / utalvány / műszakpreferencia.
- **Nem** bérpótlék, **nem** nyilvános shaming TV.
- Pulton: Több menü tetején `Mai cél X/60` (hét/hó tooltip) — nincs topbar sáv.

## Edge case

| Helyzet | Szabály |
|---------|---------|
| Közös login | Rangsor a `created_by` címke — váltás ajánlott |
| PDA handoff | Credit a fizetést lezáró usernek |
| Void / visszáru | Nem bünteti a ligát |
| Csúcsidő | Nincs élő countdown a vevő előtt |

## Siker (4–6 hét)

- ≥80% eladás POS műszakkal
- Napi 60 cél rendszeresen közel / felett
- Heti győztes kitöltve
