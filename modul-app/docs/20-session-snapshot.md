# 20 — Session snapshot + single-login (P2)

## Döntés

Navigációkor a staff shell **aláírt cookie snapshotból** olvassa a
`tenantId` / `role` / `allowedPages` értékeket (15 perc TTL), nem futtat
minden requesten entitlements + page_access waterfallt.

A middleware **minden** staff requesten ellenőrzi a nonce ↔ DB egyezést
(`checkAppSession`) — single-login azonnal érvényesül.

## Cookie

| Név | Tartalom |
|---|---|
| `modul_session_v1` | HMAC-SHA256 aláírt **wire v2** JSON (page bitset) |
| `modul_session_nonce` | Single-login nonce (DB `app_user_sessions`) |
| `modul_login_pending_*` | 120s — Safari bootstrap (GET `/auth/session-bootstrap`) |
| Supabase auth | JWT / refresh (változatlan) |

### Wire v2 (méret)

A full-access `allowedPages` + `entitledPages` path-tömbök ~4KB környékére nőttek
(Safari cookie limit) → a cookie **nem íródott**, navigáció `nonce_missing` / soft-nav
„semmit nem csinál” tünetet adott (pl. `/platform/partnerek`).

**v2:** `ap` / `ep` = `*` (teljes katalógus) vagy base64url bitset az `ALL_PAGE_KEYS`
sorrendjében. Cél: tipikus token ≪ 2KB. Legacy v1 cookie még olvasható TTL-ig.

## Login flow (Safari-biztos)

1. Server Action: **stale wipe előbb** → `signIn` → `registerAppSession` → pending + long-lived cookie  
2. Redirect → **GET** `/auth/session-bootstrap`  
3. Bootstrap: pending → long-lived Set-Cookie (**nincs getUser kapu**) → `/home`

A bootstrap nem hív `getUser()`-t: a SA után a sb-* cookie gyakran még
nincs a következő GET-en; a régi kapu téves `session_replaced`-et okozott.

## Kick reasons (`?reason=`)

| reason | Jelentés |
|---|---|
| `nonce_missing` | Nincs pending / session nonce cookie |
| `nonce_mismatch` | Cookie ≠ DB (másik eszköz / stale) |
| `session_row_missing` | Nincs `app_user_sessions` sor |
| `session_check_error` | DB hiba |
| `auth_cookie_missing` | Supabase auth cookie hiány (ritka) |
| `session_replaced` | Legacy / általános |

## Invalidálás

- Logout / login (új nonce)
- Saját page_access / role változtatás
- Impersonation start/end
- TTL lejárat (15 perc) → következő request DB rebuild
- Snapshot > ~3.9KB → nem állítjuk (log), nonce path marad
  (v2 bitset után full-access tipikusan <2KB)

## Env

```
SESSION_SNAPSHOT_SECRET=<min 16 char random>
```

Vercel region: `dub1` (`vercel.json`) — Supabase Modul West EU (Ireland).

**Teljes playbook:** [22-performance-playbook.md](22-performance-playbook.md).
