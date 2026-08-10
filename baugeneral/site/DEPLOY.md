# BauGenerál site — deploy notes

## Local dev

```bash
cd baugeneral/site
npm install
npm run dev
```

Runs on **http://localhost:3011**

## Environment

Copy `.env.example` to `.env.local`. Set the same keys in Vercel → Environment Variables.

| Variable | Purpose |
|----------|---------|
| `VERCEL_ENV` | Set by Vercel (`production` / `preview`). Preview builds are `noindex`. |
| `MAIL_TO` | Inbox: `mezo.david@baugeneral.hu` |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` | **Preferred** — e.g. Gmail `smtp.gmail.com:465` + app password |
| `MAIL_FROM` | Usually same as `SMTP_USER` (Gmail address) |
| `RESEND_API_KEY` | Optional if SMTP is not set |
| `GOOGLE_SITE_VERIFICATION` | Search Console HTML tag `content` value |

Without SMTP (or Resend), `POST /api/forms` returns **503**.

## Vercel

- Project root: `baugeneral/site`
- Production domain: `www.baugeneral.hu`
- Redirect bare `baugeneral.hu` → `www.baugeneral.hu` at DNS / Vercel level
- Analytics: `@vercel/analytics` (cookie-less) — no consent banner required

## DNS (DotRoll) — web only, do not touch MX

| Action | Record |
|--------|--------|
| Delete 4 Squarespace **A** on `@` | `198.185.159.*` / `198.49.23.*` |
| Add **A** `@` → Vercel IP (from Vercel Domains UI) | e.g. `216.150.1.1` |
| Change **CNAME** `www` | from Squarespace → `cname.vercel-dns.com.` (or Vercel value) |
| Keep | MX, SPF, `autodiscover`, `felho`, NS |

## Pre-launch checklist

- [x] NAP in `src/lib/company.ts`
- [x] Public phone
- [x] OG PNG via `app/opengraph-image.tsx`
- [x] Brand `icon` / `apple-icon`
- [x] Legal pages (adatkezelés, cookie, ÁSZF)
- [x] 404 / error pages
- [x] Security headers
- [ ] Vercel env: SMTP working (form → David)
- [ ] DNS cutover (above)
- [ ] `npm run build` / Vercel deploy green
- [ ] Search Console + Bing (below)

## Needs from you (cannot invent)

Fill these so the site is “complete” commercially — code is ready to receive them:

- [x] SMTP / form mail (local + set same on Vercel)
- [x] DNS cutover
- [x] Social: Facebook + Instagram in `COMPANY.social`
- [x] No public opening hours
- [x] Impressum central email stays `mezo.robert@baugeneral.hu`
- [ ] Reference copy (`Szöveg hamarosan.` in `references.ts`) — later
- [ ] Reviews widget / original logo / EN-DE / GA4 — later

## SEO / AI

- `public/llms.txt` — machine-readable company summary
- `src/app/robots.ts` — search + AI crawlers
- `src/app/sitemap.ts` — static routes + referenciák + futó projektek + megjelenések
- Preview / local: `noindex` via `getDefaultRobots()`

### Google Search Console (go-live)

**Bekötés (ajánlott: HTML meta tag)**

1. Nyisd: [Google Search Console](https://search.google.com/search-console) → **Add property** → **URL prefix** → `https://www.baugeneral.hu`
2. Válaszd: **HTML tag** ellenőrzés
3. Másold ki a `content="…"` értéket (csak a kódot, pl. `AbCdEf…`)
4. Vercel → BauGenerál project → **Environment Variables** → Production:
   - Name: `GOOGLE_SITE_VERIFICATION`
   - Value: a kimásolt kód
5. Redeploy (vagy várj a következő deployra)
6. GSC-ben: **Verify**
7. **Sitemaps** → Add: `https://www.baugeneral.hu/sitemap.xml`

**Alternatíva DNS-sel (DotRoll):** Domain property `baugeneral.hu` → TXT rekord a GSC által adott értékkel (MX-et ne bántsd).

- [ ] Property: `https://www.baugeneral.hu` verified
- [ ] Submit sitemap: `https://www.baugeneral.hu/sitemap.xml`
- [ ] URL inspection: `/kapcsolat`, `/megjelenesek`, 2–3 press slugok
- [ ] Confirm `llms.txt` returns 200

### Bing Webmaster

- [ ] Add site + submit same sitemap

### Schema notes

- `/megjelenesek`: `CollectionPage` + `ItemList`; external articles as `citation`
- `/kapcsolat`: `GeneralContractor` + `FAQPage`
- `openingHours` / social `sameAs` appear when you fill `COMPANY`
