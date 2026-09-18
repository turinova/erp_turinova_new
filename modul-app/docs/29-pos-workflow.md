# 29 — POS workflow (`/pos`)

**Státusz:** S2 P0+P1 implementálva (scanner-first till).  
**Route:** `/pos` · műszakok: `/ertekesitesek/muszakok`  
**Add-on:** `pos` (**9 900 Ft** nettó/hó) — [33](33-packages-and-addons.md)  
**Kapcsolat:** [28-ertekesites-workflow.md](28-ertekesites-workflow.md), [31-pos-muszakzaras.md](31-pos-muszakzaras.md)  
**Legacy ötlet:** main-app `PosClient` (viselkedés, nem kód).

---

## 0. Egy mondat

> A POS = vonalkód-first pulti munkaasztal → ugyanaz a `sales_orders` mag (`channel=pos`) + azonnali fizetés + stock out.

**Nem** a manuális `/ertekesitesek/uj` (az admin űrlap — **Alap plan**).  
**Nem** unpaid/utalás (az később a manuális eladáson).

Entitlement: capability `pos` + page `/pos` + `/ertekesitesek/muszakok` (migráció: `20260517_packages_beszerzes_alap_pos_addon.sql`; korábbi blanket `/pos` az Alapból kikerült).

---

## Layout

```
Fullscreen · 50/50
Bal: kereső/scanner (tábla: Termék | Készlet | Bruttó egységár)
Jobb: táblás kosár + sticky footer
  Nettó összesen | Fizetendő (bruttó) (nagy)
  chipek (kedv / kerekítés / készlethiány)
  [Díj] [Kedv.] · [Készpénz] [Kártya] (nagy; nincs egyéb fizetés)
```

Kosár: tábla (név+chip | − qty + | **Bruttó összeg** | ✕). Kedvezménynél áthúzott eredeti + új. Díj a Bruttó összeg oszlopban. Expand: Bruttó egységár + sor-kedv. Confirm: Bruttó részösszeg → Nettó/ÁFA → Fizetendő (bruttó). Készlethiány = warning soft + chip. Scan = success flash.

**Visszáru (S5):** topbar **Visszáru** → eladás kereső → `/ertekesitesek/[id]?return=1`. Részletek: [30](30-visszaru-workflow.md).



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

Ismeretlen barcode → inline hiba; soft stock warn; empty cart CTA disabled; RPC fail → kosár megmarad; success → clear + refocus.

Migráció: `20260517_packages_beszerzes_alap_pos_addon.sql` (`pos` add-on). Korábbi: `20260511_pos_page.sql`.
