# ProGate — billing & plans (v6, **aktuális**)

**Termék:** ProGate (Turinova / HÍRÖS-ABLAK Kft.) · **App:** https://app.progate.hu  
**Státusz:** Source of truth — a kód (`src/lib/billing/plans.ts`) és ez a doc egyezik.  
**Dátum:** 2026-08-28  
**SQL:** `031_plans_v6.sql` · `028_plans_v5.sql` (trial_days → 14) · `036_platform_trial_default_14.sql`

A `PRICING.md` archív v3–v5 szekciói **történeti** kontextus; ütközés esetén **ez a fájl és a kód mérvadó**.

---

## 1. Csomagok (merchant UI)

| Plan ID | Merchant név | Bruttó / hó | ProGate felirat a widgeten |
|---------|--------------|-------------|----------------------------|
| `start` | Gyors rendelés | **7 500 Ft** | Látszik |
| `plus` / `pro` | Saját márka | **9 999 Ft** | Elrejthető (fizetés után) |

- Merchant `/csomag`: egy kártya + „Saját márka” checkbox (+2 499 Ft felár).
- `pro` = admin alias; merchant szempontból = `plus`.
- Éves: **10× havi** (2 hónap kedvezmény).
- Fizetés v1: **mailto** + admin aktiválás (nincs Stripe).

---

## 2. Próba

| Mező | Érték |
|------|--------|
| Hossz | **14 nap** (`TRIAL_DAYS_DEFAULT`, `platform_settings.trial_days`) |
| Self-serve signup | Igen (`/signup`) — ugyanaz a hossz |
| Invite / admin create | Alapértelmezés 14; platform admin 1–90 felülírható |
| Trial alatt widget | Teljes termék, minden modul |
| ProGate felirat próba alatt | **Mindig látszik** — nincs white-label trialban |
| `organizations.plan` trial alatt | `start` (post-trial csomag jelzése) |
| Effektív partner limit trial alatt | `plan_defaults.pro.partner_limit` (= **500** v6 után) |

**Lejárat után (trial expired, nincs aktiválás):**
- Widget **működik** (ha `widget_enabled` és nem `suspended`).
- Portál: korlátozott UX / blur (top-N gate bekapcsolva).
- Konverzió: mailto + admin „Aktiválás”.

---

## 3. Feature-kapuk (kód = UX)

| Képesség | start | plus/pro (fizetős) | Próba |
|----------|-------|-------------------|-------|
| Gyors rendelés (widget) | ✓ | ✓ | ✓ |
| Kereső, Excel, email lista, kép, rendelések, javaslatok, listáim | ✓ | ✓ | ✓ |
| Fotó → lista (`canParseImage`) | ✓ | ✓ | ✓ |
| ProGate felirat elrejtése | — | ✓ (csak fizetős) | **soha** |
| Merchant modul ki/bekapcsolás | — | — | Minden modul mindig be (v6) |

**v3-tól eltérés (szándékos v6):**
- Nincs 15/40/120 vevő csomag-pitch — soft cap **500**.
- Fotó nem Pro-exkluzív — vision COGS elfogadva launch fázisban.
- Nincs három külön árkártya merchanten — start + saját márka add-on.

---

## 4. Aktív vevő meter

**Definíció:** naptári hónapban ≥1 widget-rendelés (`b2b_orders`, `source=widget`).

| Paraméter | Érték |
|-----------|--------|
| Soft partner limit (minden plan) | **500** |
| Soft SKU limit | **80 000** |
| Widget-open | Analitika, **nem** billing |
| Limit túllépés | Portál top-N blur (ha `portal_top_n_gate`); **widget megy tovább** |

Override: `organizations.partner_limit_override` (admin „Egyedi”).

---

## 5. Kód ↔ doc térkép

| Viselkedés | Fájl |
|------------|------|
| Árak, plan ID, feature gate | `src/lib/billing/plans.ts` |
| Effektív limit SQL | `sql/016_partner_meter_and_orders.sql` + `plan_defaults` |
| Trial napok signup | `src/lib/auth/signup.ts` → `TRIAL_DAYS_DEFAULT` |
| Trial napok admin create | `src/app/api/admin/orgs/route.ts` |
| Platform default trial | `platform_settings.trial_days` |
| Product mark (ProGate) | `resolveShowTurinovaMark()` |
| Kép parse API | `canParseImage()` → mindig true |
| Merchant csomag UI | `PlanCards.tsx` |

---

## 6. Archív doc figyelmeztetés

Az alábbi állítások **már nem érvényesek** (v3/v5 PRICING.md, PLATFORM §D1/D4/D11):
- 30 napos próba alapértelmezés
- Start 6 900 / Plus 12 900 / Pro 24 900 árkártya
- top 15 / 40 / 120 vevő pitch
- Fotó csak Pro
- Trial = Pro entitlement 120 vevő endowment narratíva

Történeti indoklásként megmaradhatnak; implementációhoz **ne használd**.
