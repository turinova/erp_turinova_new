# 25 — Raktárak (MVP)

**Státusz:** implementált (A fázis).  
**Route:** `/torzsadatok/rendszer/raktarak`  
**Migráció:** `supabase/migrations/20260503_warehouses.sql`  
**Kapcsolat:** [24-beszerzes-workflow.md](24-beszerzes-workflow.md)

---

## 0. Egy mondat

> Raktár = **hol** van a készlet. MVP-ben egy (vagy több) név + kód + default; webshop location map később.

---

## 1. Zárolt döntések

1. Nem WMS — nincs polc / bin / 2-step.
2. Tenantnak mindig van **≥1** élő raktár és **pontosan 1** `is_default`.
3. **1 aktív raktár → nincs választó** a PO / beérkezés UI-n; **≥2 → MenuSelect** (PO draft + beérkezés checking).
4. Channel ID **nincs** a `warehouses` soron. Shoprenter / Shopify / Magento → későbbi `warehouse_channel_locations` (P2).
5. Új PO: `warehouse_id` = választott vagy default.
6. Soft delete tiltott, ha van élő PO ehhez a raktárhoz → inkább inaktív.

---

## 2. Séma

`warehouses`: name, code, is_default, is_active, opcionális cím, note, soft delete.

Unique (alive): `(tenant_id, lower(code))`, `(tenant_id, lower(name))`, egy default / tenant.

Seed: meglévő + új tenant → **Fő raktár** / `FO` (trigger `tenants_seed_default_warehouse_trg`).

`purchase_orders.warehouse_id` NOT NULL → FK `warehouses`.

---

## 3. UI

Lista: Név · Kód · Város · Státusz · Műveletek.  
Primary: **Új raktár**.  
Dialog űrlap: név*, kód*, aktív, alapértelmezett, cím, megjegyzés.  
Egy raktár esetén default switch zárolt.

---

## 4. API (lib)

| Függvény | Használat |
|---|---|
| `listWarehouses` | Raktárak oldal |
| `listActiveWarehouses` | Későbbi MenuSelect |
| `getDefaultWarehouse` | Olvasás |
| `ensureDefaultWarehouse` | PO create biztonsági háló |
| `createWarehouse` / `updateWarehouse` / `softDeleteWarehouse` | CRUD |

---

## 5. Edge case-ek

| ID | Szabály |
|---|---|
| W1 | 0 raktár → empty CTA / seed / ensure |
| W2 | Default törlés / inactive → tilos csere nélkül |
| W3 | Új default → többi `is_default=false` |
| W4 | Utolsó aktív → nem inaktiválható |
| W5 | PO hivatkozás → soft delete helyett inaktív |
| W6 | Dupla kód/név → magyar hiba |
| W7 | PO create: választott `warehouse_id` vagy default |

---

## 6. Következő fázisok

| Fázis | Mit |
|---|---|
| **B** | ~~Beérkezés stock + multi MenuSelect~~ — kész (PO célraktár + checking override) |
| **C** | `warehouse_channel_locations` — `channel` ∈ shoprenter \| shopify \| magento |
| **D** | ~~Belső transfer; termék készlet per raktár~~ — v1 kész ([27](27-keszlet-atadasok.md)); in-transit később |

**P2 channel map (jelzés):** párosítás Beállítások / Integrációk alatt — nem a raktár törzs űrlapon.
