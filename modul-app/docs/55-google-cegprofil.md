# 55 — Google cégprofil (értékelő link)

**Állapot:** 1. fázis kész — profilkezelés a Cégadatokban. 2. fázis kész — értékeléskérő csatornák (lásd [Értékeléskérés](#értékeléskérés-2-fázis)). Partnerportál kezdőlap kártya kész.

## Cél

A tenant megadja a Google cégprofilja **értékelő linkjét**. Ebből egy saját, stabil rövid link lesz (`{origin}/g/{kód}`), amit később SMS-ben, a partnerportálon vagy QR-kódon használunk. A rövid link mérhető, és a Google-link cseréjekor sem változik.

## Hol

`Beállítások → Cégadatok` → **Google cégprofil** szekció (a Nyitvatartás után). Ugyanaz a **Mentés** gomb ment (egy primary/képernyő). Viewer csak lát.

## Elfogadott bemenetek

| Bemenet | Eredmény |
|---|---|
| `https://g.page/r/{CODE}/review` (séma vagy `/review` nélkül is) | ✓ értékelő űrlap, normalizálva |
| `https://search.google.com/local/writereview?placeid=ChIJ…` | ✓ űrlap + Place ID mentve |
| Nyers Place ID `ChIJ…` | ✓ writereview link épül belőle |
| `https://maps.app.goo.gl/…` | ⚠ menthető, de „próbáld ki” figyelmeztetés (lehet profil, lehet űrlap) |
| `google.*/maps/place/…`, `maps.google.*` | ✗ „Ez a cégprofil oldala, nem az értékelő űrlap” |
| Bármi más | ✗ formátum hiba |

Forrás: `src/lib/company/google-profile.ts` (+ teszt). Súgó a mezőnél: Google → Értékelések → **Több értékelés kérése** → Másolás.

## Rövid link

- Kód: 6 karakter, olvasható ábécé (nincs 0/O/1/l/I), **egyszer** generálódik az első mentéskor, utána nem változik (link törlésekor sem).
- `/g/{kód}` (route handler, service role): 302 → `google_review_url`; ismeretlen kód / törölt link → semleges „A link nem elérhető” oldal (404, noindex).
- `?s=sms|partner|qr|email` → forrás a naplóban; ismeretlen → `other`, üres → `direct`.
- Kattintásnapló: `google_review_link_clicks` — link-előnézet botok (iMessage/WhatsApp/Facebook stb.), HEAD és prefetch **nem** számít. A Cégadatokban „Megnyitás az utolsó 30 napban: N”.
- A `/r/` útvonal foglalt (rendelés státusz link) — ezért `/g/`.

## Adatmodell (`20261003_tenant_company_google_profile.sql`)

`tenant_companies`: `google_review_url` (https, ≤500), `google_place_id`, `google_review_code` (unique), `google_profile_updated_at`.
`google_review_link_clicks`: `tenant_id`, `source`, `user_agent`, `clicked_at`; RLS select = tenant tag / platform admin; írás csak service role.

Migráció nélkül a Cégadatok működik, a szekció a migráció futtatását kéri (`42703` tolerálva).

## Google szabályok (későbbi CTA-khoz kötelező)

- **Nincs ösztönzés** értékelésért (kedvezmény, ajándék) — tilos.
- **Nincs review gating** — nem szűrjük előre, ki kapja meg a linket elégedettség alapján (pl. NPS 9–10 csak). Mindenki ugyanazt a linket kapja.
- SMS-ben: csak tranzakciós kontextusban (átvétel után), egyszer; marketing SMS-hez hozzájárulás kell.

## Értékeléskérés (2. fázis)

A vevő a státusz linket (`/r/{token}`) **csak a „Kész, átvehető” SMS-kor** nyitja meg — átadás után már nem. Ezért 3 csatorna (a státusz oldal két változattal), mind a rövid linkre mutat (`/g/{kód}?s=…`):

| # | Csatorna | Mikor | Forrás | Alapért. |
|---|---|---|---|---|
| 1 | Státusz oldal kártya | Átvehető: alul, `first`/`repeat` szöveg; Átadva: felül, `primary` | `status` (+ `t=token` → link/ügyfél a naplóban) | Be |
| 2 | QR az átvételi blokkon | Vevői példány, vonalkód előtt (ESC/POS natív QR + böngésző SVG) | `qr` | Ki |
| 3 | Köszönő SMS | Átadás után, `next_morning` (másnap 10:00) vagy `after_2h` | `sms` | Ki |

**Hol állítható:**

- `Beállítások → Google értékelések` (`/beallitasok/google-ertekelesek`) — **hub**: minden be/ki kapcsoló, QR szöveg (≤80), köszönő SMS időzítés, gyakoriság (90/180/365 nap, alap 180), 30 napos megnyitás-statisztika csatornánként. Link nélkül a csatornák tiltva + „Értékelő link megadása” → Cégadatok.
- `Cégadatok` — maga a Google link (marad).
- `SMS sablonok` → `#review-thanks` — a köszönő SMS szövege (`{review_url}` kötelező), előnézet Átvehető/Átadva váltóval.
- `Átvételi blokk` — csak állapot sor + előnézet, link a hubra.
- `Ügyfél űrlap` — **„Értékelés-kérő SMS”** hozzájárulás, külön az „SMS értesítés”-től (`review_sms_consent`, `review_sms_consent_at`). **Új ügyfélnél alapból be** (`20261008`: oszlop default `true` + insert trigger kitölti a `_at`-ot) minden létrehozási útvonalon: űrlap, gyors ügyfél, Opti, ügyfélrendelés, átadáskori pótlás, partner `ensure_partner_customer`. Meglévő ügyfelek nem változnak. Feltétel: a pultnál szóban megkérdezni / ÁSZF tájékoztatás, leiratkozás = kapcsoló ki.

**Státusz kártya szabályai** (`lib/reviews/status-cta.ts`): csak siker/semleges státusznál; ha erről a linkről már kattintott → „Köszönjük” állapot; ha a gyakorisági kereten belül bárhonnan kattintott → nincs kártya. A kártya soha nem töri a státusz oldalt (hiba → nincs kártya). Ha a primary kártya látszik, a Hívás gomb másodlagos (egy primary/képernyő).

**Köszönő SMS folyamat:**

1. Átadáskor (`finishQuoteHandover`, `handOverSpecialOrderItemsAction`) `enqueueReviewThankSms` → `review_request_queue` sor, ha be van kapcsolva és az ügyfél hozzájárult. Rendelésenként egyszer (unique index). Soha nem dob.
2. Cron `/api/cron/review-sms` (óránként `5 * * * *`, `Bearer CRON_SECRET`) → `processReviewThankSmsQueue`: küldési ablak 9–19 (Budapest), 3 napnál régebbi → `stale`; újraellenőrzi: kapcsoló, link, SMS add-on, hozzájárulás, telefonszám, gyakoriság (utolsó kérés **és** utolsó kattintás). Kihagyás okai az SMS naplóban.
3. Siker → `customers.last_review_request_at`, `sms_send_events` (`review_thanks`).

> **Vercel Hobby** csak napi cront enged — ott a deploy elbukik az óránkénti ütemezéssel. Ilyenkor napi futás (pl. `0 9 * * *`), és csak a `next_morning` időzítés értelmes.

> **Jogi:** az értékeléskérő SMS reklámnak minősülhet (Grt.) — ezért külön, kifejezett hozzájárulás. Élesítés előtt jogász ellenőrizze.

**Adatmodell** (`20261004_review_requests.sql`): `tenant_review_settings`, `customers.review_sms_consent*` + `last_review_request_at`, `google_review_link_clicks.share_link_id/customer_id` + `status` forrás, `review_thanks` sablon kulcs, `review_request_queue`. Migráció nélkül: hub figyelmeztet, státusz kártya alapból be, ügyfél kapcsoló rejtve, `/g` naplózás minimális oszlopokkal.

### Partnerportál kezdőlap (4. csatorna)

A partner (B2B vevő) a kiválasztott bolt kezdőlapján kap egy kártyát a csempék alatt, ugyanabban a sávban, ahol az NPS van. Forrás: `?s=partner`.

**Mikor látszik** (`lib/partner/review-prompt.ts`, tesztelve):

- van kiválasztott bolt, nincs jelszó beállítás folyamatban, a boltnál be van kapcsolva (`tenant_review_settings.partner_portal_enabled`, alap: be) és van értékelő link;
- a partnernek van átadott (`finished`) rendelése ennél a boltnál az elmúlt **30 napban**;
- nem jelezte, hogy „Már írtam” (akkor ennél a boltnál végleg eltűnik);
- kattintás után a bolt gyakorisági keretéig (90/180/365) nem jön újra;
- „Most nem”: 30 nap, majd 90 nap, a harmadik után soha.

Egyszerre egy kérés: ha a kártya esedékes, az NPS a következő belépésre vár. Az NPS pontszám **nem** befolyásolja, ki látja a kártyát (nincs review gating). Szöveg: 1–4 átadott rendelésnél „Írnál pár szót a(z) {Cégnév} munkájáról?”, 5-től „{N} rendelésen vagyunk túl együtt, köszönjük!”, plusz a legutóbbi átvett rendelés száma és a témajavaslat (pontosság, minőség, kiszolgálás). A csillagsor a gomb része, nem választható.

**Adat** (`20261007_partner_review_prompts.sql`): `partner_review_prompts` (partner + bolt kulcs: `clicked_at`, `self_reported_at`, `dismissed_at`, `dismiss_count`); RLS: a partner a saját sorát írja, a bolt tagjai olvashatják (hub: „Partnerek, akik jelezték, hogy írtak”). A bolt beállítását a partner kezdőlap service role-lal olvassa. Migráció nélkül nincs kártya, a kezdőlap változatlan.

## Következő fázisok

- **B — Places API kereső:** cégnév alapján profil választás, Place ID automatikusan (Text Search IDs-only ingyenes; név/cím Pro SKU). Csak Place ID tárolható tartósan.
- **C — Business Profile API (OAuth):** értékelések listázása/válasz — engedélyköteles, csak igény esetén.
- Több telephely: telephelyenként saját link — ha a telephely modell megjön.
