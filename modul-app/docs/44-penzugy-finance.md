# 44 — Pénzügy modul (AR / ÁFA / export)

**Státusz:** P0 + P0b + soft-lock.  
**Route:** `/penzugy` · `/szamlak` · `/szamlak/uj` · `/penzugy/kintlevoseg` · `/penzugy/afa` · `/penzugy/exportok`  
**Migráció:** `20260566_penzugy_finance.sql`, `20260567_penzugy_page_access.sql`, `20260568_manual_invoice_source.sql`  
**Kapcsolat:** [36](36-szamlazas-workflow.md) Számlázz Agent

---

## 0. Egy mondat

> A **Számlázz.hu Agent** a jogi kiállítás + NAV; az Optinova **Pénzügy** a kintlévőség, ÁFA-egyeztetés és könyvelői export — mert az Agent **nem listáz időszakot**.

---

## 1. Oldalak

| Oldal | Feladat |
|---|---|
| Áttekintés | KPI: kinnlevő, lejárt, 7 nap, havi ÁFA, Agent hibák |
| Bizonylatok | Meglévő `/szamlak` lista + forrás filter + **Új számla** (`/szamlak/uj`, `manual`) |
| Kintlévőség | Aging + **Fizetés** (ERP + `action-szamla_agent_kifiz`) |
| ÁFA összesítő | Teljesítés hónap × ÁFA kulcs (díjbekérő nélkül) |
| Exportok | XLSX / CSV / ZIP + soft-lock + Számlázz adóhatósági deep-link |

---

## 2. Agent használat

| Művelet | Form mező | Hol |
|---|---|---|
| Kiállítás | `action-xmlagentxmlfile` | issue-sale / issue-quote + `szamlaKulsoAzon` |
| Sztornó | `action-szamla_agent_st` | meglévő |
| PDF | `action-szamla_agent_pdf` | meglévő |
| Taxpayer | `action-szamla_agent_taxpayer` | meglévő |
| **Kiegyenlítés** | `action-szamla_agent_kifiz` | `registerInvoicePayment` |

**Nincs** Agent időszaklista → AR / ÁFA / export = ERP `invoices` + `invoice_lines`.

---

## 3. Adat

- `invoice_lines` — kiállításkor snapshot (ÁFA riport)
- `invoice_payments` — ERP fizetés + `agent_synced`
- `finance_period_locks` — YYYY-MM soft-lock
- `invoices.net_total` / `vat_total` / `external_id` / `paid_amount`

---

## 4. Szabályok

1. Díjbekérő **nem** az ÁFA összesítőben.  
2. Lezárt hónapra nem állítható ki visszadátumozott számla (feloldás: owner/admin).  
3. Adóhatósági ellenőrzési XML → Számlázz UI (nem Agent).  
4. Régi bizonylatoknak lehet üres tétel-snapshot — új kiállítás után teljes.

---

## 5. DoD

- [ ] Kintlévőségről fizetés → ERP `fizetve` + Számlázz kifiz (ha Agent OK)  
- [ ] ÁFA hónap egyezik a tétel-snapshotokkal  
- [ ] Export XLSX letölthető  
- [ ] Soft-lock blokkolja az issue-t
