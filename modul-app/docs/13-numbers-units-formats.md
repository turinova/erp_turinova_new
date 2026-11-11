# 13 — Számok, mértékegységek és formátumok

Ebben a domainben ez nem apróság, hanem üzleti konzisztencia.

## 1. Általános elv

- A user magyar formátumot lát.
- A bevitel legyen toleráns, a megjelenítés legyen konzisztens.
- A mező környezete mindig mutassa az egységet.

## 2. Tizedesek és ezreselválasztó

- Megjelenítés: `hu-HU`
- Tizedesjel: vessző a UI-ban
- Ezreselválasztó: magyar formátum szerinti tagolás
- Bevitelkor pont és vessző is elfogadott

## 3. Pénz

- Listaoszlop fejlécében jelenjen meg a pénznem és a nettó/bruttó: pl. `Bruttó (Ft)`, `Bruttó egységár`
- Ne ismételd minden cellában a `Ft`-ot, ha az oszlop egységes — kivéve ahol a certainty miatt kell
- Nettó / bruttó alapnézet modulonként legyen rögzítve, ne esetleges

### Értékesítés + POS (zárolt)

- Ügyfél-facing számok = **bruttó** (ÁFA-val)
- Címke-szótár:
  - `Bruttó egységár` — 1 db ára
  - `Bruttó összeg` — sor (qty × egység)
  - `Bruttó tételek` / `Bruttó díjak` / `Bruttó részösszeg` — összesítő
  - `Nettó összesen` / `ÁFA összesen`
  - `Fizetendő (bruttó)` — amit az ügyfél fizet
- Tilos: magában „Összeg”, „Egységár”, „Bruttó”, „Nettó” ha többféle értelmezés lehet
- Hint az összesítőn: „Az árak bruttók (ÁFA-val).”

## 4. ÁFA

- Az ÁFA ne csak százalék legyen, hanem emberileg érthető megnevezés is, ahol kell
- Ha nettó és bruttó együtt látszik, a különbség legyen egyértelmű (`Nettó összesen` vs `Fizetendő (bruttó)`)

### Polcár / bruttó round-trip (termékek)

- Egész Ft nettó ↔ bruttó `Math.round` mellett **nem minden bruttó állítható elő** (pl. 4000 Ft @ 27%: nincs olyan egész nettó, amire `round(net×1.27)=4000`).
- **Forrásigazság a polcárra:** `accessories.price_gross` (beírt bruttó). A `price_net` ÁFA-bázis / margin számításra van.
- `netFromGross` round-trip-safe: ha van pontos nettó, azt választja; ha nincs, a polcárat nem növelő legközelebbit.
- POS / eladás kosár: `unitPriceGross` = tárolt `price_gross`, ne nettóból számolt megjelenítés.
- Migráció: `20260599_accessories_price_gross.sql`.

## 5. Mértékegységek

Példák:

- `db`
- `m`
- `m2`
- `mm`
- `%`
- `kg`

Szabályok:

- mindig ugyanazt a rövidítést használd
- az egység ne csak backend mező legyen, UI-ban is látszódjon
- a usernek ne kelljen fejben konvertálnia

## 6. Kerekítés

- A kerekítési szabály modulonként legyen dokumentálva
- Az összesítés és a részletek ne mondjanak ellent egymásnak
- A UI-ban kijelzett érték ne okozzon számlázási vagy ügyfélvitát

### Lapszabászat / Opti ajánlat — Ft forrásigazság

- Mentett ajánlaton a **sor bruttó/nettó = DB snapshot** (`quote_material_pricing`, `quote_service_lines`, accessories, fees).
- Detail, PDF és Számlázz **ugyanazt** a sort mutatja / számlázza — **tilos** `egységár × mennyiség` újraszámolás a kijelzett összeghez (egységár csak info).
- **Egész Ft a számításnál** (anyag tábla / él / szabás / megmunkálás): `gross = round(netRaw×(1+ÁFA))` = forrásigazság; összesítő = Σ egész sorok — nincs ±1 Ft `round(sum)` vs `sum(round)` eltérés.
- **Nettó/ÁFA bontás = nettó-első** (`lib/money/vat-split.ts` `splitGross`): `áfa = kerekít(nettó × kulcs / 100)`, `bruttó = nettó + áfa` (Számlázz 260). Tilos `áfa = bruttó − round(bruttó / 1,27)` — a bruttók ~21%-ánál 1 Ft-tal eltér, több tábla / anyag összegén több Ft-tal.
- **Opti díjak (`cutting_fees`):** beírt bruttó = forrásigazság (`fee_per_meter_gross`, `*_fee_*_gross`); nettó ÁFA-bázis. Opti egységár a tárolt bruttóból — ne `round(net×1.27)` (pl. 600 Ft ne legyen 599). Migráció: `20260619_cutting_fees_gross.sql`.
- Végösszeg: `quotes.final_total_gross`. Számlázz (`lib/invoicing/net-first-lines.ts` `fitNetFirstLines`): minden tétel nettó-első szabályos, Σ bruttó = végösszeg fillérre.
  - Ha egy tétel bruttója nettó-első módon nem érhető el, a ±1 Ft-ot másik tétel veszi át; végső esetben a tétel két azonos nevű tételre bomlik (mennyiség megosztva; Előleg / Díjbekérő: 2 × 1 db).
  - Összesítőben ÁFA kulcsonként külön sor (vegyes kulcs nem olvad össze); 0% marad 0%.
  - Jóváírás (`quote_fees.kind = credit`) negatív tétel; ±2 Ft-nál nagyobb eltérés → hibaüzenet, nincs csendes egyösszegű fallback.
  - Kapuőr: `buildSaleInvoiceXml` nem küld olyan tételt, ahol `|áfa − nettó × kulcs / 100| > 0,5` vagy `nettó + áfa ≠ bruttó`.
  - Ajánlat részletek „Nettó ár” és PDF „Nettó / Áfa összesen” ugyanebből a bontásból jön, mint a számla.

## 7. Beviteli tolerancia

Példák, amiket érdemes elfogadni:

- `12,5`
- `12.5`
- `2db`
- `600x400`
- `10 %`

Parse után a normalizált érték jelenjen meg egyértelműen.

## 8. Táblák és összesítések

- számok jobbra
- `tabular-nums`
- összegekhez egyértelmű címke
- aktív szűrőknél a kimutatott összesítés mindig az aktuális nézetre értendő

## 9. Mit ne csináljunk

- váltakozó nettó/bruttó logika ugyanazon modulon belül
- hol `m²`, hol `m2`, dokumentálatlanul
- eltérő kerekítés két képernyőn
- szabad szövegben eldugott egység
