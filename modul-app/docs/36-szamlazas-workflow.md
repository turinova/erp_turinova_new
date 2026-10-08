# 36 — Számlázás (Számlázz.hu) — Alap plan

**Státusz:** P0–P2d + S1.5 (fulfill előtt végszámla tiltva).  
**Route:** `/szamlak` (Pénzügy → Bizonylatok; `?source=sale|opti_order`) · `/beallitasok/szamlazas` · sale detail · quote detail · POS  
**Legacy:** `/ajanlatok/bizonylatok` → redirect `/szamlak?source=opti_order`  
**Migráció:** `20260526_szamlazas_alap.sql`, `20260534_quote_billing_snapshots.sql`, `20260568_manual_invoice_source.sql`, `20260588_invoice_source_links.sql`  
**Kapcsolat:** [28](28-ertekesites-workflow.md) S3, [29](29-pos-workflow.md), [37](37-lapszabaszat-quote-workflow.md)

---

## 0. Egy mondat

> Az ERP kiállítja a bizonylatot a **Számlázz.hu Agent**en — értékesítésről, lapszabászatról **vagy manuálisan** (`/szamlak/uj`). Manuális kiállítás előtt **PDF előnézet**. Végszámla (sale): **fizetve + áru átadva** (`fulfilled`).

---

## 1. Fogalmak

| UI | DB / Agent |
|---|---|
| Díjbekérő | `dijbekero` — `confirmed` unpaid-on is OK |
| Előlegszámla | `elolegszamla` |
| Számla / végszámla | `szamla` (+ `dijbekeroSzamlaszam`) — kell `paid` + **nem** `confirmed` |
| Sztornó | `sztorno` |
| Előnézet | `<elonezetpdf>true` |

---

## 2. Boldog út (utalás B)

```
confirmed + unpaid → Díjbekérő (preview)
→ Fizetés → paid
→ Áru átadása → fulfilled + stock
→ Végszámla (preview)
→ Díjbekérő: „Felhasználva” — NEM sztornózható
```

```
paid KP → fulfilled → Számla (preview)
```

POS: auto számla preview nélkül.

---

## 3. State machine (zárolt)

| Állapot | Engedélyezett | Tiltott |
|---|---|---|
| confirmed, unpaid, nincs doksi | Díjbekérő; előleg | Végszámla |
| confirmed, unpaid, dijbekérő | Fizetés | Új dijbekérő; végszámla |
| confirmed, paid | **Áru átadása** | Végszámla (szerver + UI) |
| fulfilled, unpaid | Díjbekérő / fizetés | — |
| fulfilled, paid, dijbekérő | **Végszámla** | Új dijbekérő; dijbekérő sztornó |
| fulfilled, paid, végszámla | PDF; sztornó számlán | Új számla; billing edit |

Helper: `invoice-rules.ts`. RPC: `fulfill_sale`.

---

## 4. UX

- **Create:** számlázás rejtve; utalás default átadásra vár  
- **Issue dialógus:** PDF iframe; Kiállítás csak preview után; típus elrejtve ha a rendszer tudja  
- **Fizetés** + confirmed → `?fulfill=1`; fulfill után `?issue=normal`  
- **Sale detail:** egy next-step banner; header lean (PDF / visszáru); pénz `#fizetesek`, számla `#bizonylatok`
- **Lista `/szamlak`:** forrás chip (Mind / Értékesítés / Lapszabászat / Manuális / **Összevont**) + view chip (default **Fizetésre vár**); **Új számla** → `/szamlak/uj`; PDF / sor; kinnlevő glance; lejárt határidő warning.
- **Manuális `/szamlak/uj`:** két mód — **Szabad kézi** (`manual`) vagy **Megrendelésekből** (`consolidated` + `invoice_source_links`). Egy primary (sticky Kiállítás); díjbekérő = csak átutalás; **Előnézet frissítése** gomb (nem auto-Agent); kötelező vevőnév+cím; period lock preview-n is.
- **Összevont:** ügyfél → számlázható sale+opti (paid, nincs végszámla) multi-select → tételek behúzása (forrásszám prefix) → preview → egy Agent számla + N link. Sztornó felszabadítja a linkeket.
- Nav: **Pénzügy → Bizonylatok** (nem Értékesítés / Lapszabászat alatt).
- **Detail Bizonylatok:** közös `SourceInvoicesSection` (sale + quote) — kiállítás CTA + PDF, sztornó, életút
- **Szótár:** sale `confirmed` = **Átadásra vár**; lifecycle pending = **Fizetésre vár**
- **Fizetési mód (dialógus):** díjbekérő = **csak átutalás** (zárolt); előleg / számla = KP / kártya / utalás. Default: utolsó ERP payment, különben átutalás. Nem rögzít ERP befizetést — az külön CTA.
- **Típus mátrix (sale + quote):** unpaid + 0 doksi → díjbekérő (default) / előleg; unpaid + díjbekérő/előleg → csak előleg; paid → csak számla/végszámla (díjbekérő tilt); unpaid végszámla **tilt**.
- **Sale fulfill-gate:** `confirmed` + paid → számla CTA üres (előbb Áru átadása); quote-nál nincs stock-gate.

---

## 5. Fázisok

| | Scope |
|---|---|
| **P0–P2d** | Settings, lista, POS, state machine, preview — **kész** |
| **S1.5** | confirmed / fulfill + végszámla guard — **kész** |
| **Lista UX** | Kapcsolat + életút badge — **kész** |
| **P3** | Split KP+utalás |
| **P4** | Soft foglalás; `linked_proforma_invoice_id` schema |
| **Opti order** | Lapszabászat `opti_order` — **kész** (paid guard + díjbekérő tilt paid mellett; kézi; snapshot) |

DoD: utalás → Függőben + nincs stock → dijbekérő → fizetés → Áru átadása → stock → végszámla.  
Lapszabászat: megrendelés → (kézi) díjbekérő/számla preview → `/szamlak` deep-link.
