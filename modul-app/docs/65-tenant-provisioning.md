# 65 — Új tenant létrehozás (provisioning) — terv

> Státusz: **terv, nincs implementálva** (2026-11-26). A mostani flow elemzése + a bulletproof célállapot.
> Kapcsolódó: `17` (SaaS architektúra), `21` (platform ops), `33` (csomagok), `46` (funkció mátrix).

## 1. Jelenlegi flow (`createPlatformTenant`, `src/lib/platform/actions.ts`)

1. Validálás (név ≥ 2, slug regex, e-mail, jelszó ≥ 8) → slug foglaltság check.
2. `tenants` insert `status='provisioning'`, 14 nap trial, `max_seats=10`.
   - Trigger: „Fő raktár” (`seed_default_warehouse_for_tenant`), 5 rendszer fizetési mód (`tenants_seed_payment_methods`).
3. `auth.admin.createUser` (email_confirm) → `tenant_memberships` owner.
4. `assignDefaultPlanAndMaterialize` → mindig **Bolt** → `tenant_entitlements`.
5. `seedOwnerPageAccess`, `tenant_onboarding` upsert, opcionális ÁFA 0/27%.
6. `status='active'`; opcionális `seedDemoMasterData`.

## 2. Hiányosságok

### Magas
- **Nem atomikus:** rollback csak a 3. lépésig. A 4–5. lépés hibái `console.error`-ba nyelődnek, a tenant mégis `active`. Timeoutnál árva `provisioning` tenant + auth user marad.
- **Jelszó felülírás:** `platformAddTenantMember` meglévő usernél a megadott jelszóval felülírja a user **globális** jelszavát (minden tenantjában).
- **Státusz nincs érvényesítve:** `suspended` / `read_only` sehol; `churned` csak a membership listában szűrve; `access_until` / trial csak kijelzés. Mobil API (`lib/mobile/auth.ts`) egyáltalán nem nézi a tenant státuszt. RLS `is_tenant_member` csak a tagság státuszát nézi.
- **Meglévő e-mail nem lehet owner** új tenantnál (add-member viszont engedi) → egy ember két cég ownere csak SQL-lel.

### Közepes
- Nincs plan választás létrehozáskor (mindig Bolt; a plan mellékhatások csak `setTenantPlan`-nál futnak).
- Demó Jelenlét Bolt planen à la carte → „plan alkalmazása tenantokra” (`syncPlanBundledAddons`) leveszi.
- Demó lapszab törzsadatot seedel, de a lapszabászat modult nem kapcsolja be.
- `grant*PageAccess` minden tagnak `can_access: true` upsert → felülírja a kézi tiltást.
- Viewer szerepkör az owner oldallistáját kapja; írást csak pár action tilt.
- `seedOwnerPageAccess` feature key-t ír page key helyett (flag kulcsok → szemét sorok).
- Műhely plan: `partner_orders` / `quote_ready_sms` oldaljog nem grantolódik.
- Add-member: auth user létrejön, membership insert hibánál nincs törlés (árva user); `max_seats` nincs ellenőrizve.

### Alacsony
- Slug check-then-insert race → generikus hibaüzenet.
- HR ünnepnapok csak 2027-ig.
- Purge storage: `list` limit 1000 / prefix.
- Nincs `writePlatformAudit` a létrehozásra; jelszó plain textben, nincs kötelező csere.

## 3. Hiányzó alapadatok demó nélkül

| Adat | Most | Probléma |
|---|---|---|
| `tenant_companies` | nincs | update-only mentések (nyitvatartás, PO intro, Google review) 0 sort frissítenek |
| `units` | nincs (csak backfill volt) | díjtípus nem vehető fel (`unit_id` NOT NULL) |
| `tenant_customer_order_settings` | nincs (csak backfill) | SQL default-ra hagyatkozunk |
| ÁFA | csak checkbox esetén | — |
| HR típusok/ünnepek | csak Jelenlét bekapcsolásnál | — |

## 4. Döntések (2026-11-26)

- **Owner jelszó:** admin adja meg, **első belépéskor kötelező csere** (`user_metadata.must_change_password` + middleware redirect).
- **Lejárt trial / `access_until`:** tenant **`read_only`** (türelmi idő után). Írás tiltás közös `assertTenantWritable`-lel.

## 5. Célállapot — bulletproof flow

### A. Wizard (1 primary / lépés)
1. **Cég:** név, slug (élő check, ékezet → slug), adószám, város.
2. **Csomag:** plan + engedett à la carte add-onok, trial hossz / `access_until`, `max_seats`.
3. **Owner:** meglévő user kötése (jelszó **nem** változik) vagy új user ideiglenes jelszóval; demó checkbox.
4. Összegzés → „Cég létrehozása”.

### B. `provision_tenant(spec jsonb)` RPC — egy tranzakció
- tenant (`provisioning`) + `tenant_companies` + alapadatok (6. pont) + plan/addon + materialize + bundle mellékhatások + oldaljog **page key** alapon + owner membership + audit.
- Auth user az Admin API miatt tranzakción kívül: **két fázis** (user create idempotens → RPC). RPC hiba → frissen létrehozott user törlése; user hiba → tenant `provisioning` + Retry.
- Idempotencia: slug unique + kliens oldali `idempotency_key`.

### C. Aszinkron lépések
- `tenant_provisioning_steps` (step, status, error, attempts): demó seed, logó, katalógus képek. Mind idempotens (fix storage path + upsert).
- Tenant oldalon „Provisioning” kártya: lépések ✓/✗ + Újrapróbál.

### D. `tenant_health(tenant_id)`
- Hiányzó owner, cégadat, egység, ÁFA, entitlement ↔ page access eltérés, következő évi ünnepnap, lejárt hozzáférés.
- `active` csak üres health mellett; platform listában badge; meglévő tenantok auditja.

### E. Érvényesítés
- Közös `assertTenantUsable` / `assertTenantWritable`: session snapshot, mobil API, RLS helper (tenant `status`).
- `suspended` → nincs belépés; `read_only` → írás tiltva; `churned` → rejtett. Cronok/kiosk is figyelje.

### F. Tagok
- Jelszó felülírás csak explicit checkbox-szal; `max_seats` check; árva user rollback.
- Viewer saját szűk oldallista; grant ne írja felül a `revoked` sort (explicit tiltás jelölő).
- Utolsó owner nem távolítható el.

### G. Életciklus
- `provisioning → trial → active → read_only / suspended → churned`.
- Purge: soft delete → 30 nap → job; storage rekurzív + lapozott törlés.

## 6. Alapadat (seed) stratégia

**Elv:** ami nélkül egy képernyő használhatatlan és tenant-független → mindig. **Árat, cégadatot, katalógust élesbe nem seedelünk** (rossz ár = rossz ajánlat).

### 1. szint — minden tenant
- Cégadatok sor (űrlapból), ÁFA 27/18/5/0 (AAM) — default 27, fizetési módok (trigger), egységek (db, m, fm, m², kg, óra, csomag), Fő raktár + pénztár, CSO beállítás, onboarding sor.
- Jelenlét esetén: dolgozótípusok + ünnepnapok tárgyév + következő év.

### 2. szint — plan / addon bekapcsolásakor (nem csak létrehozáskor)
- Lapszabászat (Műhely): 1 „Lapszabász gép” alap paraméterekkel, vágási díj **ár nélkül**, díjtípusok (élzárás, szállítás, csomagolás) ár nélkül, „ajánlat kész” SMS sablon, Opti alapbeállítás.
- Ár nélküli tételnél az ajánlat blokkolva, amíg a checklist nem zöld.

### 3. szint — lapanyagok: választható
- Üres lista empty state: **„Kezdőcsomag betöltése”** (globális sablonkatalógusból másolás: népszerű gyártók/dekorok, méret, vastagság, szálirány, kép — **ár nélkül**, „Ár hiányzik” címke, Opti nem engedi ajánlatba).
- **CSV/Excel import**; kézi felvitel. Élzáró / szálas / termék ugyanígy.

### Onboarding checklist (Kezdőlap + platform health)
Cégadatok + logó · vágási díj ár · ≥ 1 lapanyag árral · SMS feladó · első kolléga.

### Demó
`seed_demo_master_data` (ügyfelek, dolgozók, árazott katalógus) **csak demó/teszt tenantba**; a demó checkbox Műhely plant + Jelenlét + Belépők addont is állítson, és mozgó adatot (rendelés, ajánlat, jelenlét, belépők) napi frissítéssel.

## 7. Nyitott kérdések
1. Globális sablonkatalógus forrása (kézi lista vs. mostani demó katalógus)?
2. Díjtípus / vágási díj: ár nélkül vagy javasolt piaci ár?
3. CSV import első körben?

## 8. Ütemezés
1. **Biztonsági minimum (½–1 nap):** jelszó felülírás fix, státusz check mobil API + session, hibák felszínre, audit.
2. **`provision_tenant` RPC + wizard + plan választó + 1–2. szintű seed + health (2–3 nap).**
3. **Provisioning lépések + retry, kötelező jelszócsere, read_only érvényesítés (2 nap).**
4. **Kezdőcsomag + import, RLS státusz, életciklus jobok (külön kör).**
