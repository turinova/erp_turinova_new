# Archívum Fázis 1 — `archiv.turinova.hu` (párhuzamos)

**Cél:** a customer-portal **ugyanazon** a Vercel projekten + régi Supabase-en elérhető legyen `https://archiv.turinova.hu` alatt, **anélkül**, hogy a `turinova.hu`-t elvennéd (az Nov 9-ig marad).

**Hostname:** `archiv.turinova.hu` (magyar írás). Az `archive.` elírás middleware-ben 308 → `archiv.`, ha a DNS oda mutat.

---

## 1. DNS

A `turinova.hu` zónában:

| Típus | Név | Érték |
|---|---|---|
| CNAME | `archiv` | Vercel target (`cname.vercel-dns.com` vagy a Domains UI által megadott) |

Opcionális (elírás):

| CNAME | `archive` | ugyanaz / vagy `archiv.turinova.hu` |

TTL: cutover előtt rövid (pl. 300).

---

## 2. Vercel (customer-portal projekt)

1. Project → **Settings → Domains**
2. **Add** `archiv.turinova.hu`
3. Igazold a DNS-t, várd meg az SSL-t
4. **Ne** töröld a `turinova.hu` / `www.turinova.hu` domaineket (Fázis 1)

---

## 3. Supabase (régi projekt: `oatbbtbkerxogzvwicxx`)

**Authentication → URL Configuration → Redirect URLs** — add hozzá:

```
https://archiv.turinova.hu/**
https://archiv.turinova.hu/reset-password
```

**Site URL:** Fázis 1-ben maradhat `https://turinova.hu` (vagy `https://www.turinova.hu`).  
Nov 9 (Fázis 2) után állítsd: `https://archiv.turinova.hu`.

A forgot-password `window.location.origin`-t használ → archiv hoston a redirect az archiv originre megy.

---

## 4. Deploy

A Fázis 1 kód (archív banner, typo redirect) legyen a customer-portal `main`-en / production deploy-on, mielőtt a domain smoke megy.

---

## 5. Smoke checklist

- [ ] `https://archiv.turinova.hu/login` betölt, **Archívum** info banner látszik
- [ ] Régi email + **régi** jelszó → `/home`, archív banner a kezdőlapon
- [ ] Mentett ajánlat / rendelés lista OK
- [ ] Elfelejtett jelszó → reset link `archiv.turinova.hu` originre megy
- [ ] Regisztráció továbbra is zárva (`/register` → login, API 403)
- [ ] `https://turinova.hu/login` **még** a régi portál (Nov 9-ig)
- [ ] (ha DNS van) `https://archive.turinova.hu/...` → 308 `archiv.`

---

## 6. Fázis 2 (Nov 9) — emlékeztető, nem most

1. `turinova.hu` (+ www) → modul-app (partner)
2. customer-portal publikus host: csak `archiv.turinova.hu`
3. Régi Supabase Site URL → `https://archiv.turinova.hu`
4. Opcionális: write-lock (submit/save tiltás)

---

## Kód (Fázis 1)

| Fájl | Szerep |
|---|---|
| `lib/archive-host.ts` | host detektálás |
| `lib/migration-notice.ts` | `ARCHIVE_HOST` / typo konstans |
| `components/migration/ArchiveHostBanner.tsx` | UI |
| `views/Login.tsx` | banner az archiv hoston |
| `app/(dashboard)/home/*` | banner SSR host alapján |
| `middleware.ts` | `archive.` → `archiv.` 308 |
