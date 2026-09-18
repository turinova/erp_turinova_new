# 32 — Termék árajánlat (sales quote)

**Státusz:** Q0 + Q1 (billing snapshot).  
**Route:** `/ertekesitesek/arajanlatok`  
**Migráció:** `20260515_sales_quotes.sql`, `20260516_sales_quote_billing_snapshots.sql`  
**Kapcsolat:** [28](28-ertekesites-workflow.md) — **nem** a lapszabászat [23](23-lapszabaszat-addon.md) / `/ajanlatok`

---

## 0. Egy mondat

> Termék árajánlat = papír az ügyfélnek (nincs készletmozgás). Számlázás = **dokumentum-snapshot**. Elfogadás után **Eladás** lesz belőle (`create_sale`), a billing az ajánlatból megy át.

**Teljesen külön** a lapszabászati `/ajanlatok` + `/megrendelesek` pipeline-tól.

---

## 1. Fogalmak

| UI | DB |
|---|---|
| Árajánlat | `sales_quotes` |
| Tétel / díj | `sales_quote_items` |
| Számlázás (doksi) | `billing_*_snapshot` az ajánlaton |
| Eladás | convert → `sales_orders` (`converted_sale_id`) |
| Másolat / revízió | `cloned_from_id` |

---

## 2. Státusz + szerkesztés

`draft` → `sent` → `accepted` (convert) · `lost` · `expired` · `cancelled`

| Státusz | Tétel/ár | Header + számlázás | Convert |
|---|---|---|---|
| `draft` | create-kor; sorcsere: Másolat | `update_sales_quote_draft` | igen |
| `sent` | tilt → **Másolat** | tilt → Másolat | igen |
| `accepted` / lezárt | tilt | tilt | nem |

- `sent` után élő módosítás **tilos** — Másolat új draftba (`cloned_from_id`).  
- Convert: manuális eladás; fizetés kötelező. Sale billing = **quote snapshot**, nem élő törzs.

---

## 3. Számlázás (big-brand)

1. Ügyfél választás → default billing a törzsből **másolódik** az ajánlatra.  
2. Create / draft szerkesztés: felülírható **csak az ajánlaton**.  
3. Detail mindig a **snapshotot** mutatja (nem `getCustomer` élő).  
4. Opcionális CTA: **Mentés az ügyfél törzsbe is** (megerősítés; default off).  
5. Convert: snapshot → `sales_orders.billing_*_snapshot`.

---

## 4. UX

Create ≈ manuális eladás, fizetés nélkül + érvényesség + számlázás blokk.  
Primary: **Ajánlat mentése**.  
Detail: Kiküldve · Eladás létrehozása · Elveszett · Másolat · (draft) Szerkesztés.

---

## 5. Edge

Üres kosár tilt · ügyfél kötelező · lejárt/lost/cancelled convert tilt · dupla convert tilt · soft stock warning convertkor · törzs sync soha automatikus.
