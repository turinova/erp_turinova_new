# 54 — Partner visszajelzés: NPS + mindig elérhető javaslat

**Státusz:** implementálva (V2 — valódi NPS 0–10 + javaslat-bedobó)  
**Cél:** a partner home-on (1) ritkán, feltételhez kötve NPS kérdés, (2) bármikor küldhető javaslat; beérkezők a platform `/visszajelzesek` inboxban.  
Kapcsolódó: [20-partner-portal.md](20-partner-portal.md), [03-ux-certainty-first.md](03-ux-certainty-first.md)

---

## Két külön dolog

| | NPS (0–10) | Javaslat |
|---|---|---|
| Mikor látszik | 90 naponta, ha jogosult (lent) | **Mindig**, ha van cég és nincs claim-flow |
| Mentés | **Kattintásra** (450 ms debounce), a sor utólag frissül | „Javaslat küldése” gomb |
| Küldés után | Köszönő sor → átvált a javaslat-bedobóra | Köszönő sor → visszacsukódik, újra írható |
| Elutasítás | „Most nem” → 14 / 30 nap; pontszám után „Bezárás” (a pont mentve) | Nincs, csukott állapotban egy sor |

Egyszerre csak egy sáv látszik a home-on (4 munkacsempe után): ha esedékes az NPS, az; különben a javaslat.

## NPS jogosultság (`lib/partner/feedback-visibility.ts`)

- van kiválasztott cég, nincs `must_set_password`
- **≥1 beküldött rendelés** (legyen mit értékelni)
- **fiók ≥7 napos** (migrált első belépés ne kérdezzen)
- az utolsó NPS válasz óta ≥90 nap
- dismiss snooze: 1. → 14 nap, 2+ → 30 nap

## Pszichológia → döntések

- **Egyértelmű tárgy:** „Mennyire ajánlanád **ezt az online rendelőfelületet** egy asztalos ismerősödnek?” — nem keveredik a lapszabászat szolgáltatásával (vágás, határidő).
- **Őszinteség:** „A Turinova csapata olvassa, nem a lapszabászat.” (Igaz: a tenant nem látja; ha ez változik, a szöveget is.)
- **Számskála, nem csillag:** a csillag felfelé torzít; 0–10 számgomb a szabvány NPS. Nincs előválasztás, nincs piros/zöld a partner oldalon.
- **Mentés kattintásra:** az első kérdés után nagy a lemorzsolódás → minden megadott pont megmarad; javítható 24 órán belül.
- **Pontszám szerinti követő kérdés** (opcionális), címke-chipek a visszajelzés **jellegéről** (nem funkciólista).
- **Nincs teljesítetlen ígéret:** köszönő szöveg „Elolvassuk, és ez alapján fejlesztünk.” (A „szólunk, ha kész” csak a P1 „Megcsinálva” visszacsatolással jöhet.)

| Csoport | Követő kérdés |
|---|---|
| 0–6 kritikus | Mi zavar a legjobban? Ezt javítjuk elsőként. |
| 7–8 passzív | Mi hiányzik ahhoz, hogy 10-est adj? |
| 9–10 promóter | Örülünk! Mi az, ami a legtöbbet segít? |

Címkék: Valami nem működik · Nehéz kiigazodni · Lassú · Hiányzik valami · Ötletem van · Ez tetszik. Szövegek egy helyen: `lib/partner/feedback-copy.ts`.

## Vizuális

- Kártya: `bg-surface` + border + 3px borostyán bal sáv; ikon borostyán soft körben (`--tile-feedback-soft` / `-ink`)
- NPS gombok: 0–10, mobilon 6+5 rács, desktopon egy sor, ~36px; kiválasztva `bg-ink`
- Billentyű: egy Tab-megálló, nyilak / Home / End lépkednek
- Tilos: teli hero blokk, gradiens, glow, welcome screen, kötelező szöveg, FAB

## Adat

Tábla: `partner_product_feedback` — migrációk sorrendben: `20260930`, `20261001`, `20261002`.

- `kind`: `nps` (score 0–10 kötelező) / `suggestion` (score null)
- `tags text[]`, `prompt_variant` (`low|mid|high`), `updated_at`
- `partner_user_id` → `on delete set null` (fióktörléskor a visszajelzés megmarad)
- RLS: partner beszúr saját sort; saját sort 24 órán belül frissítheti; platform admin olvas / jelöl
- Javaslat limit: 10 / 24 óra / partner (szerveroldalon)
- Prompt állapot: `partner_profiles.product_feedback_dismissed_at` + `product_feedback_dismiss_count`

## Platform inbox (`/platform/visszajelzesek`)

- NPS sáv: pontszám (90 nap, **partnerenként a legutolsó válasz**), n, promóter / passzív / kritikus arány; n < 30 → „Kevés adat”
- Típus fülek: Mind · Javaslatok · Értékelések · **Kritikusok** (0–6, ezeket érdemes 48 órán belül felhívni)
- „Csak megnézetlen”, címke szerinti szűrés (`?tag=`), lista limit 25

## Később

- **P1:** „Megcsinálva” státusz + partner home sáv „Amit kértél, elkészült”; kritikusoknál „Felhívtam” állapot; belső / teszt fiókok kiszűrése az NPS-ből; „Javaslat” link a partner menüben (Opti közben is)
- **P2:** Google-értékelés a lapszabászatra — **review gating tilos** (nem csak promótereket kérünk, a pontszámtól függetlenül)

## Explicit NEM

- Google review keverése ebbe a kártyába
- Floating FAB mint fő belépő
- Popup belépéskor
- Csillagskála az NPS-hez
