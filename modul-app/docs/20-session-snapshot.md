# 20 — Session snapshot (P2)

## Döntés

Navigációkor a staff shell **aláírt cookie snapshotból** olvassa a
`tenantId` / `role` / `allowedPages` értékeket (15 perc TTL), nem futtat
minden requesten entitlements + page_access waterfallt.

## Cookie

| Név | Tartalom |
|---|---|
| `modul_session_v1` | HMAC-SHA256 aláírt JSON snapshot |
| `modul_session_nonce` | Single-login nonce (DB `app_user_sessions`) |
| Supabase auth | JWT / refresh (változatlan) |

## Invalidálás

- Logout / login (új nonce)
- Saját page_access / role változtatás
- Impersonation start/end
- TTL lejárat (15 perc) → következő request DB rebuild

## Env

```
SESSION_SNAPSHOT_SECRET=<min 16 char random>
```

Vercel region: `dub1` (`vercel.json`) — Supabase Modul West EU (Ireland).
