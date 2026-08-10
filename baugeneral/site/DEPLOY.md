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

Without SMTP (or Resend), `POST /api/forms` returns **503**.

## Pre-launch checklist

- [ ] Fill NAP in `src/lib/company.ts` (see `baugeneral/docs/OPEN-QUESTIONS.md`)
- [x] Public phone published (`COMPANY.phones.primary`, `isPublicPhone`)
- [ ] Add real OG image if SVG is not sufficient for social previews
- [ ] Legal pages content (adatkezelés, cookie, ÁSZF)
- [ ] `npm run build` passes
- [ ] Old baugeneral.hu stays live until new site is 100% ready

## Vercel (suggested)

- Project root: `baugeneral/site`
- Production domain: `www.baugeneral.hu`
- Redirect bare `baugeneral.hu` → `www.baugeneral.hu` at DNS / Vercel level

## SEO / AI

- `public/llms.txt` — machine-readable company summary (NAP, Press appearances with slug URLs, Contact facts)
- `src/app/robots.ts` — allows search + AI crawlers (training bots allowed; tighten if policy changes)
- `src/app/sitemap.ts` — static routes + referenciák + futó projektek + **megjelenések slugok**
- Preview / local: `pageMetadata` → `noindex` via `getDefaultRobots()`

### Google Search Console (go-live)

- [ ] Property: `https://www.baugeneral.hu`
- [ ] Submit sitemap: `https://www.baugeneral.hu/sitemap.xml`
- [ ] URL inspection: `/kapcsolat`, `/megjelenesek`, 2–3 press slugok (pl. `janoshalmi-jarasi-hivatal`)
- [ ] Confirm `llms.txt` returns 200: `https://www.baugeneral.hu/llms.txt`

### Bing Webmaster (ChatGPT / Copilot index)

- [ ] Add site + submit same sitemap

### Schema notes

- `/megjelenesek`: `CollectionPage` + `ItemList` (own URLs); external articles as `citation` — not `NewsArticle` on our domain
- `/megjelenesek/[slug]`: `WebPage` + `citation` + breadcrumb
- `/kapcsolat`: `GeneralContractor` LocalBusiness (`url` = contact page) + `FAQPage` — no phone in schema if not public
