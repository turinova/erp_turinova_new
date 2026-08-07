# MVP építési terv — lépésről lépésre

**Előfeltétel:** `baugeneral/docs/` elolvasva.  
**Cél:** Élesre kész marketing site a régi baugeneral.hu **lecserélése előtt**.

**Technikai minta:** `hiros-ablak/site/` (Next.js App Router, Vercel, `company.ts`, `seo.ts`, `llms.txt`).

---

## Fázis A — Projekt váz (1. lépés)

- [x] `baugeneral/site/` — `create-next-app` vagy hiros struktúra másolás (csak ami kell)
- [x] `package.json`, `tsconfig`, `next.config`, `eslint`
- [x] `src/lib/company.ts` — NAP (lásd [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md))
- [x] `src/lib/seo.ts` — hiros-ból adaptálva
- [x] `src/lib/footer-data.ts`, `src/lib/nav-data.ts`
- [x] `src/app/layout.tsx` — Organization JSON-LD, `lang="hu"`
- [x] `src/app/robots.ts` — + AI search crawler rules
- [x] `src/app/sitemap.ts` — statikus útvonalak
- [x] `public/llms.txt`
- [x] `DEPLOY.md` — Vercel root: `baugeneral/site`
- [x] `.env.example` — SMTP űrlaphoz (ha kell)
- [x] Dev port: pl. `3011` (ne ütközzön hiros `3010`-cel)

**Kimenet:** üres shell fut, llms.txt és robots elérhető.

---

## Fázis B — Globális komponensek (2. lépés)

- [x] `SiteHeader` + nav (HU)
- [x] `SiteFooter` + NAP + llms link
- [ ] `ContactForm` — POST `/api/contact` vagy `/api/forms`
- [ ] `RevealOnLoad` / animáció (opcionális, hiros minta)
- [x] `Breadcrumb` + JSON-LD
- [ ] `FaqSection` + `buildFaqJsonLd()` helper
- [x] Alap CSS / brand színek (baugeneral.hu logó)
- [x] Stub oldalak minden menü URL-re (`StubPageShell`)

**Kimenet:** layout minden oldalon működik.

---

## Fázis C — Főoldal (3. lépés)

- [ ] Hero + érzelmi ígéret
- [ ] Gyors tények blokk
- [ ] Futó projektek szekció (adat: `projects.ts`)
- [ ] 3 pillér
- [ ] Szolgáltatás kártyák
- [ ] 3 referencia kiemelő
- [ ] Folyamat teaser → `/folyamat`
- [ ] FAQ + schema
- [ ] Űrlap szekció
- [ ] WebSite + FAQPage + LocalBusiness JSON-LD

**Kimenet:** konverziós útvonal végigjárható.

---

## Fázis D — Szolgáltatás oldalak (4. lépés)

Sorrend (fontosság):

1. [ ] `/szolgaltatasok/ipari-epuletek` ★
2. [ ] `/szolgaltatasok/tarshazak`
3. [ ] `/szolgaltatasok/csaladi-haz-epites`
4. [ ] `/szolgaltatasok/kozepuletek`
5. [ ] `/szolgaltatasok/felujitas`

Mindegyik: 7 blokk sablon, Service + FAQ schema.

---

## Fázis E — Folyamat + garancia (5. lépés)

- [ ] `/folyamat` — 7 lépés, **HowTo** JSON-LD
- [ ] `/garancia-es-felelosseg` — folyamat nyelv, FAQ

---

## Fázia F — Projektek (6. lépés)

### Futó

- [ ] `/futo-projektek` lista
- [ ] 2–4 `/futo-projektek/[slug]` — adat kitöltése ügyféllel
- [ ] `dateModified` meta + látható dátum

### Referenciák (kész)

- [ ] `/referenciak` lista
- [ ] 3 slug: autószalon, társasház, családi ház
- [ ] Kihívás → megoldás → eredmény copy

---

## Fázis G — Rólunk + kapcsolat (7. lépés)

- [ ] `/rolunk` — cég történet, Mező Róbert idézet (nem hero arc)
- [ ] `/kapcsolat` — térkép, NAP, űrlap, LocalBusiness schema

---

## Fázis H — Angol (8. lépés)

- [ ] `/en` főoldal
- [ ] `/en/services/industrial-buildings`
- [ ] `/en/process`
- [ ] `/en/contact`
- [ ] 3 referencia EN (vagy shared slug + `lang` switch)
- [ ] `hreflang` alternates

---

## Fázis I — Jogi + űrlap éles (9. lépés)

- [ ] Adatkezelési tájékoztató
- [ ] Cookie tájékoztató
- [ ] ÁSZF (ha kész)
- [ ] SMTP éles — értesítés a megfelelő mailboxra
- [ ] Honeypot + rate limit (hiros minta)

---

## Fázis J — QA + deploy (10. lépés)

- [ ] Lighthouse mobil
- [ ] Rich Results Test — FAQ, Organization, HowTo
- [ ] `llms.txt` 200 OK
- [ ] Sitemap submit Search Console
- [ ] Facebook OG debugger
- [ ] Preview `noindex` ellenőrzés
- [ ] Domain DNS → Vercel (ha kész a csere)

---

## MVP checklist — tartalom

| Elem | Darab |
|------|-------|
| Szolgáltatás oldal | 5 |
| Futó projekt | 2–4 |
| Kész referencia | 3 |
| FAQ oldalanként | 5–10 kérdés |
| EN oldal | 5+ |

## MVP-ben NINCS

- Kalkulátor
- Tudástár / blog
- Városi landingek
- Supabase
- Hírös hangsúly
- epito-artukor

---

## Fejlesztési sorrend összefoglalva

```
A váz → B komponensek → C főoldal → D ipari → E folyamat
  → F projektek → G rólunk/kapcsolat → H EN → I jogi → J deploy
```

**Következő chat / session:** Fázis A indítása Agent módban.
