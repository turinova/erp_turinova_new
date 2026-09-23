# 36 — Számlázás (Számlázz.hu) — Alap plan

**Státusz:** P0–P2d + S1.5 (fulfill előtt végszámla tiltva).  
**Route:** `/szamlak` · `/beallitasok/szamlazas` · sale detail · POS  
**Migráció:** `20260526_szamlazas_alap.sql`  
**Kapcsolat:** [28](28-ertekesites-workflow.md) S3, [29](29-pos-workflow.md)

---

## 0. Egy mondat

> Az ERP kiállítja a bizonylatot a **Számlázz.hu Agent**en. Manuális kiállítás előtt **PDF előnézet**. Végszámla: **fizetve + áru átadva** (`fulfilled`).

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
- **Sale detail:** egy next-step banner; aktív számla → PDF gomb  
- **Lista `/szamlak`:** view chip (default **Fizetésre vár**); PDF / sor; kinnlevő glance; lejárt határidő warning.
- **Szótár:** sale `confirmed` = **Átadásra vár**; lifecycle pending = **Fizetésre vár**

---

## 5. Fázisok

| | Scope |
|---|---|
| **P0–P2d** | Settings, lista, POS, state machine, preview — **kész** |
| **S1.5** | confirmed / fulfill + végszámla guard — **kész** |
| **Lista UX** | Kapcsolat + életút badge — **kész** |
| **P3** | Split KP+utalás |
| **P4** | Soft foglalás; `linked_proforma_invoice_id` schema |

DoD: utalás → Függőben + nincs stock → dijbekérő → fizetés → Áru átadása → stock → végszámla.
