# 29 — POS workflow (`/pos`)

**Státusz:** S2 P0+P1 implementálva (scanner-first till).  
**Route:** `/pos`  
**Kapcsolat:** [28-ertekesites-workflow.md](28-ertekesites-workflow.md)  
**Legacy ötlet:** main-app `PosClient` (viselkedés, nem kód).

---

## 0. Egy mondat

> A POS = vonalkód-first pulti munkaasztal → ugyanaz a `sales_orders` mag (`channel=pos`) + azonnali fizetés + stock out.

**Nem** a manuális `/ertekesitesek/uj` (az admin űrlap).  
**Nem** unpaid/utalás (az később a manuális eladáson).

---

## Layout

```
Fullscreen · 50/50
Bal: kereső/scanner
Jobb: táblás kosár + sticky footer
  Nettó | Bruttó (nagy)
  chipek (kedv / kerekítés / készlethiány)
  [Díj] [Kedv.] · [Készpénz] [Kártya] (nagy; nincs egyéb fizetés)
```

Kosár: tábla (név+chip | − qty + | **Bruttó** | ✕). Kedvezménynél áthúzott eredeti + új. Díj összeg a Bruttó oszlopban. Ár/sor-kedv expand. Készlethiány = warning soft + chip. Scan = success flash.



---

## 2. Happy path

```
Scan/keres → kosár → (díj/kedv/ügyfél) → Készpénz|Kártya|Egyéb
→ Confirm (due + cash round) → create_sale(channel=pos) → clear + focus
```

Primary confirm: **Eladás rögzítése**.

---

## 3. Fázisok

| | Scope |
|---|---|
| **P0+P1** | Shell, cart, search, barcode, pay sheet, session — **kész** |
| **P2** | Held cart, split, shortcuts, print |
| **P3** | Material/linear (ha kell) |

---

## 4. Edge (rövid)

Ismeretlen barcode → toast; soft stock warn; empty cart CTA disabled; RPC fail → kosár megmarad; success → clear + refocus.

Migráció: `20260511_pos_page.sql` (`/pos` entitlement).
