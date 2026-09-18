# 30 — Visszáru workflow (S5)

**Státusz:** S5-P0+P1 implementálva (counter return + POS belépő).  
**Route:** nincs külön lista — `/ertekesitesek/[id]` + `/pos` → eladás kereső.  
**Migráció:** `supabase/migrations/20260513_sale_returns.sql`  
**Kapcsolat:** [28](28-ertekesites-workflow.md), [29](29-pos-workflow.md)

---

## 0. Egy mondat

> Visszáru = **külön doksi** az eredeti eladáshoz kötve → tétel/qty + restock döntés + pénzvisszaadás. Az eredeti eladás **nem** íródik át.

**Nem** számla-storno (az S3).  
**Nem** csere nettó kosár (S5-P2).  
**Nem** külön sidebar „Visszáruk” menü.

---

## 1. Fogalmak

| UI | DB | Jelentés |
|---|---|---|
| Visszáru | `sales_returns` | Mit hoztak vissza |
| Visszáru tétel | `sales_return_items` | Eredeti sor + qty + restock |
| Visszatérítés | `sales_payments.kind=refund` | Pénz vissza |
| Restock | `restock=true` → `stock_movements` `in` / `sale_return` | Készletbe |

---

## 2. IA (15 éves teszt)

1. Megkeresem az eladást (lista / POS kereső).  
2. **Visszáru indítása** az eladás detailen.  
3. Kipipálom a tételeket, qty, készletbe? → mód → megerősítés.  
4. A listán látom: `Részben visszáru` / `Visszáru`.

Nincs külön főmenü-pont.

---

## 3. Edge case-ek (zárolt)

| # | Eset | Viselkedés |
|---|---|---|
| 1 | Részleges qty | `returnable = sold − Σ returned`; max ezt engedi |
| 2 | Többszöri visszáru | Több `sales_returns` ugyanarra az eladásra |
| 3 | Már mind vissza | Gomb rejtve / RPC reject |
| 4 | Globál kedvezmény | Pro-rata: `factor = sale.total_gross / Σ item.total_gross`; sor effektív = `round(item.total_gross × factor)` |
| 5 | Utolsó maradék qty a soron | A sor **maradék effektív bruttója** megy vissza (nincs 1 Ft lyuk kerekítésből) |
| 6 | Teljes eladás egyben (első visszáru, minden tétel) | Refund = `total_gross + cash_rounding` (amit a vevő fizetett készpénznél) |
| 7 | Készpénz refund | Magyar kerekítés a **mostani** refund összegre |
| 8 | Restock ki | Nincs `stock_movements` (sérült / kidobott) |
| 9 | Díj tétel | Visszaadható; **soha** nem restockol |
| 10 | Fizetetlen eladás | Restock OK; refund összeg 0 (nincs pénz) |
| 11 | Refund ≤ nettó befizetés | `min(számolt, paid − already_refunded)` |
| 12 | `cancelled` / `draft` | Nem indítható |
| 13 | Konkurens | `SELECT … FOR UPDATE` az eladáson |
| 14 | WH | Mindig az eredeti eladás raktára |
| 15 | Eredeti sor immutable | Qty / ár nem csökken az items táblán |
| 16 | Dollar-only refund | **Tilos** P0-ban (csak tételhez kötött) |

---

## 4. Státusz

| `sales_orders.status` | Mikor |
|---|---|
| `fulfilled` | Nincs visszáru |
| `partially_returned` | Van visszáru, de van még returnable qty |
| `returned` | Minden tétel (termék+díj) returnable = 0 |

| `payment_status` | Mikor |
|---|---|
| `paid` / `partial` / `unpaid` | Mint eddig |
| `partially_refunded` | Van refund, de nettó befizetés > 1 Ft |
| `refunded` | Σ refund ≥ Σ payment − 1 Ft |

---

## 5. Happy path

```
Detail / POS kereső → Visszáru indítása
→ tételek + qty + restock → Készpénz|Kártya
→ Confirm → create_sale_return → toast + refresh
```

Primary confirm: **Visszáru rögzítése**. Default fókusz: **Mégse**.

Címkék: `Visszatérítendő (bruttó)`, `Nettó összesen`, `ÁFA összesen` — ugyanaz a szótár mint [13](13-numbers-units-formats.md).

---

## 6. Fázisok

| | Scope |
|---|---|
| **S5-P0** | Detail wizard + RPC + státusz + lista szűrő |
| **S5-P1** | POS belépő (eladás kereső → detail `?return=1`) + restock ki + ok mező |
| **S5-P2** | Csere (return + új sale nettó) |
| **S5-P3** | Credit note / számla (S3 után) |
| **S5-P4** | Webshop RMA, unlinked refund |

---

## 7. Migráció

Futtasd: `20260513_sale_returns.sql` (előtte sales S1–S2 migrációk).
