# App Store Review — demófiók + seed

Cél: az Apple reviewer belép `review@turinova.hu`-val, és **azonnal lát adatot** a Kezdőlapon, Jelenléten és Belépőkön (üres dashboard = 4.2 / 2.1 kockázat).

## Lépések (sorrendben)

### 1) Auth user (Dashboard — SQL előtt!)

1. Nyisd a **éles** Supabase projektet (ugyanaz, amit a preview/production app használ).
2. **Authentication → Users → Add user**
   - Email: `review@turinova.hu`
   - Password: válassz erőset (pl. `ReviewTurinova2026!`) — **írd fel**, ez megy a Review Notes-ba
   - ✅ **Auto Confirm User** (email confirmed)
   - ❌ Ne kapcsold be a MFA / 2FA-t
3. Mentés. Ellenőrzés: a user listában megjelenik, Confirmed.

> Ha az email már létezik: ne hozz létre újat — a seed SQL a meglévő usert köti a demó tenanthez. Állítsd be a jelszót (Reset password / Update user), és kapcsold ki MFA-t.

### 2) Seed SQL

1. Supabase → **SQL Editor → New query**
2. Másold be: [`app-store-review-demo-seed.sql`](./app-store-review-demo-seed.sql)
3. **Run**
4. A Notice / eredmény sorban látnod kell: `tenant_id=…`, `user_id=…`, `ok`

Ha hibát kapsz: `Nincs Auth user: review@turinova.hu` → lépés 1 hiányzik.

Újrafuttatás: a script **idempotens** (slug / email alapján upsertel, seed adatot töröl-újraír a demó tenantre).

### 3) Gyors ellenőrzés az appban

Telepített preview buildön:

1. Kijelentkezés → belépés: `review@turinova.hu` + a jelszó
2. Cég: **Turinova Review Demo**
3. Kezdőlap: legyen rendelés / ajánlat összeg
4. Jelenlét: mai nap, több dolgozó, van aki „bent”
5. Belépők: mai belépők > 0, eszköz nem „nincs”
6. Több → Adatkezelés / Támogatás / Fiók törlés

### 4) Review Notes (App Store Connect, angol)

```
Demo account (no 2FA):
Email: review@turinova.hu
Password: <a 2. lépésben választott jelszó>

This is a B2B leadership app for Turinova ERP customers (multi-tenant).
Accounts are provisioned by the company admin — there is no public sign-up.
Account deletion request: More → "Fiók törlésének kérése" (email to info@turinova.hu).

Walkthrough:
1. Sign in with the demo account
2. Home — today’s orders / quotes / foot traffic / “Bent most”
3. Jelenlét — attendance for today; tap days in the week strip
4. Belépők — visitor counts (Ma / 7 nap / Hónap)
5. Több — privacy policy, support, account deletion request

Intended distribution: Unlisted App (partner / customer leadership BYOD).
```

### 5) Utána

- Production / TestFlight build + submit
- Unlisted kérvény (miután a build review alatt / approved)

## Demó adatok (mit hoz létre a SQL)

| Terület | Tartalom |
|--------|----------|
| Tenant | `Turinova Review Demo` / slug `app-store-review` |
| Tagság | owner, active |
| Entitlement | jelenlét, belépők, lapszabászat oldalak |
| Jelenlét | 8 dolgozó + mai / elmúlt napok attendance |
| Belépők | 1 eszköz + crossings (ma + előző napok) |
| Rendelés / ajánlat | demó customer + quotes (ordered + draft) |

**Ne** használd éles ügyfél tenantet — ez külön demó cég.
