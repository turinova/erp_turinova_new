# 48 — NAV bejövő számla (AP inbox) — backlog ötlet

**Státusz:** ötlet / később. **Nincs** implementáció, migráció, route.  
**Kapcsolat:** [44](44-penzugy-finance.md) Pénzügy (AR ma) · [24](24-beszerzes-workflow.md) Beszerzés · [26](26-beerkezesek.md) Beérkezés · [36](36-szamlazas-workflow.md) kimenő (Számlázz Agent)  
**Offline minta:** `nav-exports/` (gitignored) — 2024–2026 INBOUND XML + `_work` audit scriptek

---

## 0. Egy mondat

> A NAV Online Számla **INBOUND** API struktúrált e-számla feedet ad (külföldön Peppol/XRechnung ára); az Optinova **Pénzügy** oldalán ebből AP inbox + egyeztetés + spend/ár-intelligencia legyen — **nem** „NAV böngésző”.

Ma a [44](44-penzugy-finance.md) a **kimenő** AR / ÁFA / export. Ez a doc a **bejövő** (AP / kötelezettség) irány backlogja.

---

## 1. Miért

| Insight | Forrás |
|---|---|
| Struktúrált XML ≫ OCR/AI capture | Reddit / EU e-invoice gyakorlat (XRechnung thread-ek): AI ~95% → napi kézi; XML determinisztikus |
| Big brand érték nem a letöltés | Coupa, Basware, Tipalti, SAP Concur: 2/3-way match, exception queue, spend, ár/mennyiség eltérés |
| Nálunk már van bizonyíték | Offline `nav-exports/2026-inbound` → lapanyag `purchase_price_net` (Ft/m²) vs számla Ft/lap audit |
| NAV limit | PDF-et a NAV **nem** tárol; teljes e-számla csak `completenessIndicator=true`; PDF fallback = szállító |

Hivatalos: [nav-gov-hu/Online-Invoice](https://github.com/nav-gov-hu/Online-Invoice), [dokumentációk](https://onlineszamla.nav.gov.hu/dokumentaciok).  
Példa kliensek (referencia, nem dependency): [kzolti/nav-connect](https://github.com/kzolti/nav-connect), [pzs/nav-online-invoice](https://github.com/pzs/nav-online-invoice).

---

## 2. API váz (NAV OSA v3)

| Lépés | Endpoint | Szerep |
|---|---|---|
| 1 | `queryInvoiceDigest` · `invoiceDirection=INBOUND` | Időszakos katalógus (`insDate` / issue date; digest: partner, nettó/ÁFA, dátumok) |
| 2 | `queryInvoiceData` | Tételes `InvoiceData` XML (ha rendelkezésre áll) |
| 3 | Saját tárolás | Digest + XML + feldolgozási státusz tenant-ben (NAV nem „postafiók”) |

**Figyelmeztetések (NAV Q&A):**

- Régi sémák (v1/v2…) külön értelmezőt igényelhetnek — ne feltételezzük, hogy minden historikus tétel v3.
- Intervallum limit (kliensek gyakran ~35 nap / hívás) → ütemezett sync ablakokkal.
- Módosító / sztornó lánc: `originalInvoiceNumber`, `modificationIndex` — AP státuszmodellben kezelni.

---

## 3. Termékrétegek (prioritás később)

### P0 — Bejövő inbox

- Napi (vagy gyakoribb) tenant NAV sync.
- Lista: számla #, partner, nettó/ÁFA/bruttó, kiállítás, fizetési határidő, státusz.
- Státuszok (váz): `új` → `egyeztetve` / `vita` → `könyvelve` (ERP) — exact copy később.
- Duplikátum + módosító jelzés.
- **Nem** helyettesíti a szállítói PDF-et; UI: „NAV adat megvan / PDF hiányzik”.

### P1 — Egyeztetés + ÁFA

- 2-way: számla ↔ beszerzési rendelés ([24](24-beszerzes-workflow.md)).
- 3-way: + beérkezés ([26](26-beerkezesek.md)) fizikai árura.
- Bejövő ÁFA összesítő (kimenő ÁFA mellé a [44](44-penzugy-finance.md)-ben vagy külön tab).
- Cash / kötelezettség: `paymentDate` → lejáró AP KPI.

### P2 — Intelligencia

- **Spend:** top beszállító, koncentráció, havi költség, one-off spike.
- **Ár / törzs:** tétel egységár vs `purchase_price_net` / SKU (lásd §5).
- **Kontroll:** rossz vevő adószám, bankszámlaváltás, furcsa ÁFA — mint `_work/inbound_purchase_audit_report.json` offline.
- Jóváhagyás: összegküszöb + költséghely (ha lesz dimenzió).

---

## 4. Mit **ne** építsünk először

- Teljes könyvelő szoftver / főkönyvi napló.
- OCR-first pipeline (csak fallback PDF-re, ha kell).
- „NAV webes UI klón” funkcióparitás.
- Automatikus törzsár-felülírás emberi review nélkül.
- Midday/Cal UI másolás — saját certainty-first inbox ([03](03-ux-certainty-first.md), [18](18-midday-visual-reference.md)).

---

## 5. Bizonyított minta: lapanyag beszerzési ár

**Kontextus (2026-10 offline audit):**

- DB: `sheet_materials.purchase_price_net` = **Ft/m²** nettó (UI: „beszerzési nettó Ft/m²”).
- NAV tétel: `unitPrice` tipikusan **Ft/lap** (`unitOfMeasure=PIECE`).
- Összehasonlítás: `unitPrice ÷ (hossz_mm/1000 × szélesség_mm/1000)`.
- Csak teljes tábla: dims ≥ ~2000×1000, **nincs** `[T]` töredék, nincs élzáró/munkalap/hátfal.

**Tanulság P2 consumerhez:** ugyanaz a tételtábla több use case-t szolgál (AP match + árriasztás + spend) — ne külön „ár-szinkron app”.

---

## 6. Adatváz (későbbi migráció — nem final)

Tenant-scoped, RLS; lean select; lista default limit 25.

| Entitás (név váz) | Tartalom |
|---|---|
| `nav_inbound_invoices` | Digest mezők + XML ref/hash + sync meta + AP státusz |
| `nav_inbound_lines` | Tétel: leírás, qty, uom, unitPrice, nettó/ÁFA, productCode |
| `nav_inbound_matches` | opcionális: PO / receive / sheet_material / accessory link + eltérés |

Exact séma, indexek, retention: implementációkor.

---

## 7. UX irány (ha épül)

- Egy primary / képernyő: pl. listán **Egyeztet** / detailen **Könyveltre jelöl**.
- Látható sorakciók (nem hover-only).
- Destruktív / vita: default fókusz Mégse.
- Empty state: „Kapcsold a NAV technikai usert” + docs link — ne üres tábla magyarázat nélkül.
- Copy: „Bejövő számlák (NAV)” — ne „Inbound OSA digest”.

---

## 8. Csomag / jogosultság (nyitott)

- Valószínűleg **Pénzügy** vagy **Pro** feletti képesség; tenant NAV credential vault.
- Role: pénzügy + owner; ops impersonation csak olvasás?
- Döntés: visszatéréskor [33](33-packages-and-addons.md) / [46](46-csomagok-funkcio-matrix.md).

---

## 9. DoD (amikor elővesszük)

- [ ] Tenant credentials → sikeres digest sync (teszt + éles elválasztva)
- [ ] Inbox lista URL page/szűrő; nincs `select('*')`
- [ ] Legalább fejléc mezők + opcionális tétel XML
- [ ] Duplikátum / módosító nem hoz második „új” kötelezettséget vakon
- [ ] PDF hiány explicit; completeness jelzés
- [ ] Egy consumer: vagy PO-match **vagy** ár-eltérés alert (ne mind P0)
- [ ] Doc frissítve: státusz = shipped; [44](44-penzugy-finance.md) cross-link

---

## 10. Nyitott kérdések

1. Credential modell: tenant-enként NAV technikai user vs platform proxy?
2. Számlázz.hu / más agent ütközik-e a bejövő oldallal, vagy csak kimenő marad Agent?
3. Könyvelői export (bejövő) formátum — ugyanaz a soft-lock hónap?
4. Élő sync cron (Vercel) vs on-demand „Frissítés” gomb P0-ban?
5. MDF / dekor fuzzy match szabályok termékre vs csak AP fejléc P0?

---

## 11. Források (rövid)

- NAV OSA v3 interfész + XSD: onlineszamla.nav.gov.hu/dokumentaciok  
- GitHub issues: INBOUND digest dátumintervallum; completeness / no PDF (#997 környék)  
- EU/US AP: structured e-invoice preferred channel; OCR fallback (Coupa/Basware narrative)  
- Belső: `nav-exports/README.md`, `_work/inbound_purchase_audit_report.json`
