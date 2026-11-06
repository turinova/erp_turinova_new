# 52 — Partner host előkészítés (`turinova.hu`)

**Cél:** Nov 9-én a `turinova.hu` /login a **partner** portál legyen.  
**Nem most:** staff (`app.optinova.hu` marad), forgalom átkötés, `app.turinova.hu`.

Kapcsolat: [20-partner-portal.md](20-partner-portal.md), customer-portal [archiv Fázis 1](../../customer-portal/docs/01-archiv-phase1.md), [Nov 9 checklist](../../customer-portal/docs/02-nov9-cutover-checklist.md).

---

## Kód (kész / deployolható előre)

| | |
|---|---|
| `resolveAuthSurface` | `turinova.hu` + `www.turinova.hu` → **partner**; `optinova.hu` továbbra is partner (dev/legacy) |
| `PARTNER_HOST_LABEL` | `turinova.hu` |
| `STAFF_HOST_LABEL` | **`app.optinova.hu`** (változatlan) |
| Storefront app-owned | `turinova.hu` / `www` ne legyen bolt-tenant host |
| Auth hibaszövegek | partner → turinova; staff → app.optinova |

**Nov 9-ig biztonságos:** amíg a DNS a customer-portalon van, a modul-app nem szolgálja ki a `turinova.hu`-t — a kód idle.

---

## Te: Supabase Auth (SaaS / modul-app projekt)

Authentication → URL Configuration → **Redirect URLs** (hozzáadás, ne töröld az optinova-t):

```
https://turinova.hu/**
https://www.turinova.hu/**
https://turinova.hu/auth/confirm
https://turinova.hu/uj-jelszo
```

Site URL: Nov 9-ig maradhat az aktuális partner origin (`https://optinova.hu`). Nov 9 után: `https://turinova.hu`.

---

## Nov 9 cutover (emlékeztető)

1. customer-portal: primary csak `archiv.turinova.hu`
2. modul-app Vercel: add `turinova.hu` + `www`
3. DNS: apex → modul-app
4. Opcionális: `optinova.hu` → 301 `turinova.hu`
5. Staff: **ne** mozgasd

---

## Smoke Nov 9 után

- [ ] `https://turinova.hu/login` partner (nem staff)
- [ ] Migráns: jelszó beállítás / recovery
- [ ] `https://app.optinova.hu/login` staff változatlan
- [ ] `https://archiv.turinova.hu/login` régi portal
