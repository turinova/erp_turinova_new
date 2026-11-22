# 60 — Bolti lapszab kiosk (tenant self-order)

**Állapot:** 2026-11-20 — **staff Kiosk beállítások** + **P1b** tenant bootstrap / manuális **Árszámítás optimalizálással**; rendelés mentés még nincs.  
**UX / layout:** [61-bolti-kiosk-ux.md](61-bolti-kiosk-ux.md) · Opti staff: `/opti` · Lapszab add-on: [23](23-lapszabaszat-addon.md) · Quote pipeline: [37](37-lapszabaszat-quote-workflow.md) · Google link: [55](55-google-cegprofil.md) · Certainty: [03](03-ux-certainty-first.md).

---

## 0. Egy mondat

> Tenant path `/k/<slug>`-on, bolti **asztali PC-ről (egér + billentyűzet; nem érintőképernyő)** a vevő **raktár / kedvenc** anyagból, kattintós élzárással **önálló lapszab megrendelést** ad le; a pult csak fizettet / indít. Subdomain tilos. Első cél: **staff teher ↓**.

---

## 1. Zárolt döntések

| # | Döntés |
|---|---|
| 1 | **Önálló megrendelés** (nem csak lead / associate handoff) |
| 2 | Anyagkatalógus mód **tenant kiosk setting**: `stock_only` \| `favorites` \| `stock_and_favorites` |
| 3 | Él: **manuális**, interaktív tap-oldalak; opcionálisan csak **kedvenc élzárók** (tenant setting) |
| 4 | URL: **`/k/<tenantSlug>`** — **subdomain tilos** |
| 5 | Prioritás: **1) staff teher → 2) Google értékelés → 3) email lista** |
| 6 | MVP fizetés: **pultnál** (nincs online checkout az első hullámban) |
| 7 | Megmunkálás (UX mock): **multi-flag** (duplung ∧ pánthely ∧ szög egyszerre); „nélkül” mindent töröl; progressive param (lyuk/oldal, sarok/marad mm); **nincs** teljes Opti űrlap / ferde import |
| 8 | Flow: Anyag → Méret → **Megmunkálás** → Él → Kosár → Adatok |

---

## 2. Fázisok

| Fázis | Mit | Persist |
|---|---|---|
| **UX mock** | Teljes wizard mock adatokkal, `/k/[slug]` | **Nem** — local state, fake order szám |
| **P1a** | Staff `/beallitasok/kiosk`: be/ki, katalógus, él típus→anyag map, eszköz token, page_access | Igen (settings + devices) |
| **P1b** | `/k/[slug]` tenant bootstrap + manuális árszámítás (`/api/kiosk/.../price` → nest + `buildOptiQuote` + breakdown/line Ft) | Settings + price API |
| **P1c (kész)** | Leadás `/api/kiosk/.../submit` → `source: kiosk` **draft** quote, ügyfél telefon alapján kötve / létrehozva; pult: Kiosk badge, szűrő, home inbox, Teljes befizetés előtöltve. Részletek: [62](62-bolti-kiosk-pult-workflow.md) | Igen |
| **P1d** | Szigorú device gate (0 eszköz bypass megszűnik) | Igen |
| **P2** | Thank-you Google QR (`google_review_url`) | Igen |
| **P3** | Email / soft reg / marketing consent | Igen |

---

## 3. Újrahasználat vs új

| Újrahasználható (később) | Új (kiosk) |
|---|---|
| `buildOptiQuote` / nesting kalkulus | Publikus `/k/[slug]` + device gate |
| `quote_panels` séma (téglalap + él + machining flag) | Touch wizard UI (nem `OptiWorkspaceClient`) |
| Staff `/opti?quote_id=` javítás | Tenant kiosk settings |
| [55] review URL | Idle reset, attract, help sheet |

---

## 4. Hogyan teszteljük (P1c)

1. Futtasd `supabase/migrations/20261020_kiosk_settings.sql`, majd `20261021_kiosk_quotes.sql` (SQL Editor).
2. Staff: **Beállítások → Kiosk**: kapcsold be, mapeld az él típusokat, opcionálisan eszköz.
3. Dev: `KIOSK_DEV_BYPASS=true` az `.env.local`-ban (vagy 0 eszköz = átmeneti bypass).
4. Nyisd: `/k/<tenant-slug>`: anyag, kosár, **Árszámítás optimalizálással**, Adatok, **Leadom a pultnak**.
5. Staff: Kezdőlap „Kioskról érkezett” blokk, `/ajanlatok?forras=kiosk`, detailen kiosk kártya.
6. Ugyanazzal a telefonszámmal még egy leadás → ugyanahhoz az ügyfélhez kerül (nem jön létre új).

---

## 5. Tenant settings + permissions

**Staff UI:** `/beallitasok/kiosk` (Lapszabászat add-on · page key ugyanaz).  
**Migráció:** `supabase/migrations/20261020_kiosk_settings.sql`.  
**Jog:** `APP_PAGES` + `LAPSZABASZAT_PAGE_KEYS` + `product_features` / entitlement / page_access (aki Opti beállítást kapott).

| Tábla / mező | Példa |
|---|---|
| `tenant_kiosk_settings.kiosk_enabled` | bool |
| `catalog_mode` | `all` \| `stock_only` \| `favorites` \| `stock_and_favorites` |
| `favorite_sheet_ids` | uuid[] |
| `edge_type_map` | jsonb: `foil-04` / `abs-1` / `abs-2` / `abs-42-1` / `abs-42-2` → `edge_materials.id` |
| `max_panel_rows` / `max_qty_per_line` | 8 / 20 |
| `idle_warn_sec` / `idle_reset_sec` | 75 / 90 |
| `kiosk_devices` | név + `token_hash`. A token csak egyszer, párosító linkként látszik (`/k/<slug>?parositas=…`); a kiosk megnyitáskor `localStorage`-ba menti és törli a címsorból (`lib/kiosk/pairing.ts`) |

Vágási díjak **nem** itt: `/beallitasok/opti` (`cutting_fees`).

---

## 6. Nem cél most

- Subdomain / storefront host keverés
- Online fizetés
- Partner login a kioskon
- Opti feature parity (ferde él anyag, CNC mm pozíció, multi-sarok)
- Google / email a megrendelés *előtt*
