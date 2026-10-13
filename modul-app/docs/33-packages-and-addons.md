# 33 — Csomagok és add-onok

**Állapot:** 2026-10-13 — Square-szemléletű **Bolt / Bolt+ / Pro / Műhely**. Listaárak **belső**; publikus `/arak` jegelve 2027 Q2-ig.  
**Implementálva:** migráció `20260600_square_plans_bolt_bolt_plus_muhely_pro.sql` + `plan-bundles.ts` + `setTenantPlan` bundel sync + billing skip-if-in-plan.  
**Teljes funkció×csomag mátrix (CloudERP-mélység):** **[46-csomagok-funkcio-matrix.md](46-csomagok-funkcio-matrix.md)** — route-szintű, edge case-ekkel.  
**Migráció (legacy):** `20260524_alap_includes_pos_labels.sql`, `20260525_footcounter_price_5000.sql`, `20260526_szamlazas_alap.sql`, `20260922_lapszabaszat_includes_partner_sms.sql`, `20260559_customer_special_orders.sql`, `20260582_pda_pos_addon.sql`

Kapcsolódó: [21](21-platform-ops.md), [23](23-lapszabaszat-addon.md), [29](29-pos-workflow.md), [34](34-jelenlet-addon.md), [39](39-webshop-addon.md), [42](42-ugyfelrendeles.md), [45](45-pda-pos-addon.md).

---

## Planek (nettó Ft)

| Plan | Havi | Éves (10×) | Tartalom |
|---|---|---|---|
| **Bolt** | **39 990** | **399 900** | Mai „Alap”: POS, eladás, készlet, beszerzés, ügyfélrendelés, számla, pénzügy, címke, törzs |
| **Bolt+** | **59 900** | **599 000** | Bolt + **PDA** + **jelenlét (szoftver)** + **footcounter (szoftver)** |
| **Pro** | **94 900** | **949 000** | Bolt+ + webshop※ (ha él) + soft limit + prioritás support |
| **Műhely** | **49 990** | **499 900** | Bolt + **lapszabászat** (Opti, partner, átvételi blokk) |

**Próba:** 2 hónap automata → Bolt.  
**Öröklés:** Bolt+ ⊃ Bolt · Pro ⊃ Bolt+ · Műhely ⊃ Bolt (**nem** ad automatikusan PDA/jelenlét/foot — az Bolt+/Pro).

### Egyszeri / usage

| Tétel | Ár | Megjegyzés |
|---|---|---|
| Kickstart | 149–249 k | Remote workshop + import |
| Go-live | 490–790 k | Helyszín / POS |
| Jelenlét terminál (Pi / RFID) | listaár **H** | Szoftver a Bolt+/Pro-ban |
| Belépőkamera (footcounter) | listaár **H** | Szoftver a Bolt+/Pro-ban |
| SMS | **89 Ft/db** | Usage; lapszab / ügyfélrendelés |

※ Webshop: `WEBSHOP_ENABLED = false` — Pro webshopot **ne** hirdess élő nélkül ([39](39-webshop-addon.md)).

---

## Bolt (korábbi „Alap”) — mag

| Terület | Route / feature |
|---|---|
| Értékesítések + termék árajánlat | `/ertekesitesek`, `/ertekesitesek/arajanlatok` |
| Visszáru | eladás detail + POS |
| Készlet / raktár / átadás / nyitó | `/raktarak`, `/keszlet/*` |
| Beszerzés | `/beszallitok`, rendelés, `/beerkezesek` |
| POS + műszakok + adoption | `/pos`, `/ertekesitesek/muszakok`, `pos-hasznalat` |
| Ügyfélrendelés | `/ugyfelrendelesek` |
| Számlázás + pénzügy | `/szamlak`, `/penzugy/*`, `/beallitasok/szamlazas` |
| Termék címke | `product_labels` |
| Törzsadat, ügyfél, média, kereső, home | Alap oldalak |

**Nincs** Boltban: lapszabászat, jelenlét, belépőszámláló, PDA, webshop.

---

## Bolt+ — üzem csomag

Bolt + entitlement:

| Key | Szoftver | Hardver |
|---|---|---|
| `pda_pos` | `/pos/pda` | — (saját eszköz) |
| `jelenlet` | `/jelenlet`, `/dolgozok` | terminál **H** egyszeri |
| `footcounter` | `/belepok` | kamera **H** egyszeri |

Nincs külön à la carte listaár ezekre a pitchben (bundel a 59 900-ban).

---

## Műhely — vertical

Bolt + `lapszabaszat` (10 000 helyett bundel **49 990**):

- `/opti`, `/ajanlatok`, `/megrendelesek`, `/scanner`
- Tábla / szál / élzáró / gép törzs
- Partner + átvételi blokk
- `partner_orders`, `quote_ready_sms` (0 havi + 89 Ft/SMS)

PDA kell a műhelynek is → külön ajánlat (~69 900) vagy Bolt+ + Műhely elemek.

---

## Pro

Bolt+ + (élő webshop esetén) `webshop` + prioritás support / magasabb soft keret.  
Amíg a webshop jégelt: Pro = Bolt+ + support story **vagy** ne add el.

---

## Legacy add-on katalógus (DB)

A `product_addons` sorok megmaradnak entitlement / ops forrásként; **értékesítési lista**:

| Key | Régi havi | Új (20260600) |
|---|---|---|
| `lapszabaszat` | 10 000 | **0** — Műhely plan bundel |
| `jelenlet` | 9 900 | **0** — Bolt+ / Pro bundel |
| `footcounter` | 5 000 | **0** — Bolt+ / Pro bundel (+ **H**) |
| `pda_pos` | 7 900 | **7 900** à la carte (Műhely); Bolt+/Pro-n billing **skip** |
| `webshop` | 12 900 | 12 900 · Pro ※ · enable gate |
| `partner_orders` | 0 | Műhely bundel |
| `quote_ready_sms` | 0 + 89/db | Műhely / usage |
| `beszerzes`, `pos`, `product_labels` | `active=false` | Boltban |

**Plan kulcsok:** `bolt` (ex-`alap`, default) · `bolt_plus` · `muhely` · `pro`.

**Öröklés kódban:** `src/lib/platform/plan-bundles.ts` — `setTenantPlan` / „Alkalmaz a plan cégeire” synceli a bundelt `tenant_addons` sorokat; Műhelyen PDA/jelenlét/foot à la carte megmaradhat.

**Billing:** `estimateTenantMonthlyBill` nem számláz add-on havidíjat, ha a plan feature set tartalmazza az add-on key-t (double-bill védelem).

---

## Platform

- Plan / add-on: platform tenant → `setTenantPlan` (bundel) / `setTenantAddon` / materialize → entitlements.
- Tenant UI: nincs self-serve switch ([21](21-platform-ops.md)).
- Vegyes backfill: `billing_notes` tartalmazhat `package_migrate:review …` — manuális átnézés.
- Részletes mátrix + CloudERP-összevetés hiányok: **[46](46-csomagok-funkcio-matrix.md)**.
