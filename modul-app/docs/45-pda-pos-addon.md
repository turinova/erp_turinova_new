# 45 — PDA POS add-on (gombos kézi eladás)

**Státusz:** P0 MVP  
**Key:** `pda_pos`  
**Ár:** **7 900 Ft** nettó/hó  
**Route:** `/pos/pda` (ugyanaz az app origin — **nincs** külön `pda.` host)  
**Migráció:** `20260582_pda_pos_addon.sql`  
**Kapcsolat:** [29-pos-workflow.md](29-pos-workflow.md), [33-packages-and-addons.md](33-packages-and-addons.md)  
**Ötletforrás (nem kód):** legacy `pda-portal` (PIN / monolit — tilos import).

---

## 0. Egy mondat

> Az Alap `/pos` = pulti/tablet POS. A **PDA POS add-on** = fullscreen, nagy gombos, scan-first eladás + árellenőrzés kézi eszközön — ugyanarra a `create_sale` magra.

---

## 1. Zárolt döntések (2026-10-07)

| Döntés | Érték |
|---|---|
| Host | Path `/pos/pda` — nincs subdomain |
| Auth | Normál staff login / session — **nincs PIN** |
| Pénztáros | User (`auth.uid` / membership) |
| Műszak | **Shared** open shift a kijelölt pénztáron |
| Árellenőrzés | **Benne** az addonban |
| Entitlement | Addon be → minden jogosult tag kap `/pos/pda` (P0; finom ACL később) |
| Offline | **P1 később** — P0 online only |
| Micra / fiskális | Külön track — nem P0 |

---

## 2. Mit nyit

| Route / nézet | Job |
|---|---|
| `/pos/pda` hub | Eladás · Árellenőrzés (nagy csempék) |
| Eladás | Scan + gyorscikk gombok + kosár + KP/kártya → `create_sale` |
| Árellenőrzés | Scan → név, SKU, bruttó ár, készlet |

**Nem P0:** PIN, vegyes split UI, számla, Teya terminál lépés, Micra, offline queue, anyag m² dialógus (később).

Függőség: tenantnek kell Alap **`pos`** entitlement (pénztár, műszak, sale RPC).

---

## 3. Entitlement

Features:

- `pda_pos` (capability)
- `/pos/pda` (page_key)

Enable (`setTenantAddon`) → `grantPdaPosPageAccess` (minden membership).  
Disable → materialize elveszi a feature-t; page_access sorok megmaradhatnak, de `pathIsAllowed` entitlement metszet miatt tilt.

Page catalog: `APP_PAGES` + `PAGE_CATALOG_VERSION` bump.

---

## 4. UX (PDA)

- Fullscreen shell (`PdaShell`): `visualViewport` height + safe-area; **nincs** document scroll.
- Portrait-first; gombok **≥48–56px**; **fix dock** alul (összesítő + KP/kártya).
- Hub → Eladás / Árellenőrzés.
- **Kétcsatornás capture:** rejtett wedge sink + globális key buffer (`usePdaScanner`) **és** látható kereső (név / SKU / `web_mpn` / barcode).
- Ügyfél chip → teljes képernyős sheet (`CustomerMenuSelect`); vendég = partial tilos (RPC guard).
- Certainty-first: egy primary / képernyő; ige+tárgy CTA.

### A2HS (Add to Home Screen)

- Manifest: `/pda.webmanifest` — `start_url` + `scope` = `/pos/pda`, `display: standalone`.
- Viewport: `viewport-fit=cover`, `user-scalable=false`.
- Session lejárat: login `?next=/pos/pda` → vissza a PDA-ra.
- Standalone: „Pult” link rejtve (scope-on belül marad).

---

## 5. Backend

Újrahasznál: `create_sale`, `pos_registers` / `pos_shifts`, `pos_quick_items`, barcode lookup, `searchSaleProductsAction` (+ MPN / `accessory_web.web_mpn`), payment methods, cash round.

Nincs külön order API (a legacy `pda-portal` `/api/pos/orders` **nem** cél).

Shared műszak: ugyanaz a nyitott shift, mint a pulton (vagy dedikált „Mobil” register — tenant beállítás / első elérhető register P0-ban).

---

## 6. Fázisok

| | Scope |
|---|---|
| **P0** | Addon + hub + árellenőrzés + lean eladás + scan engine + kereső + ügyfél + A2HS |
| **P0.5** | **Kosárátadás** PDA → pult (`pos_cart_handoffs`, Átadás a pultra / PDA kosarak) |
| **P1** | Offline outbox, finom page_access, anyag qty |
| **Később** | Micra bridge, WebHID |

---

## 6b. Kosárátadás (PDA → pult)

**Migráció:** `20260583_pos_cart_handoffs.sql`

| | |
|---|---|
| Cél | Polcnál gyűjtés PDA-n → fizetés a `/pos` pulton |
| PDA | Primary: **Átadás a pultra** → kód `P-001` success képernyő, kosár ürül |
| Pult | **PDA kosarak** gomb **csak ha** `hasPdaPos` — lista + **Átvétel** (Felülírás / Hozzáadás / Mégse) |
| Gate | Minden action: `tenantHasPdaPos`; addon ki → gomb nincs a DOM-ban |
| TTL | 4 óra (`expires_at`) |
| Race | `claim_pos_cart_handoff` RPC (atomi open→claimed) |

---

## 7. Tesztchecklist

- [ ] Addon ki → `/pos/pda` 404 / nincs jog  
- [ ] Addon be + POS Alap → hub látszik login után  
- [ ] Árellenőrzés: barcode + név/SKU/MPN keresés  
- [ ] Scan qty gomb fókusz mellett is bekerül  
- [ ] Dock mindig látszik (hosszú kosár)  
- [ ] Ügyfél sheet → `create_sale` customerId  
- [ ] Eladás KP: stock out + sale number  
- [ ] Nincs nyitott műszak → gate (mint `/pos`)  
- [ ] A2HS cold start → `/pos/pda`, nincs böngésző chrome  
- [ ] Session timeout → login → vissza `/pos/pda`  
- [ ] Viewer → nem ír  
- [ ] Addon ki → pulton nincs „PDA kosarak”  
- [ ] Átadás → P-xxx → pult lista → Átvétel → kosár + toast  
- [ ] Nem üres pult kosár: Felülírás / Hozzáadás / Mégse  
- [ ] Dupla claim race → egy siker  
