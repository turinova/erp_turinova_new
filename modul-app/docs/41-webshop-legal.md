# 41 — Webshop jogi oldalak (generált)

A bolt kötelező jogi oldalai **egy kontextusból generálódnak** — nincs kézzel írt ÁSZF. A webshop külön fizetős modul, ezért **minden bemenet a Webshop menüben** él, és a webshop saját táblájában (`tenant_webshop_settings`) tárolódik. Az ERP cégadat (`tenant_companies`) csak **olvasott alapérték**; a webshopban felülírható, az ERP-t nem módosítja.

Migráció: `supabase/migrations/20260551_webshop_legal.sql` (kézzel futtatandó).

## Oldalak

Publikus út: `/info/<kind>` (belső: `/s/[site]/info/[doc]`). Az `/aszf`, `/impresszum` a platform saját oldalai path-módban, ezért kell az `/info/` előtag.

| kind | Cím | Megjegyzés |
|---|---|---|
| `aszf` | Általános Szerződési Feltételek | Eladó + tárhely, rendelés menete („Megrendelés fizetési kötelezettséggel”), fizetés, szállítás, elállás / B2B visszáru, szavatosság, panasz |
| `adatkezeles` | Adatkezelési tájékoztató | Célok táblázat (funkciók szerint), adatfeldolgozók + futárok, DPF/SCC, jogok, NAIH |
| `elallas` | Elállás a szerződéstől | **Online elállási űrlap** (első szakasz, horgony `#urlap`), 1. melléklet kitöltve, kivételek, 2. melléklet minta. B2B-nél nincs űrlap |
| `szallitas-es-fizetes` | Szállítás és fizetés | Futár-táblázat, díj, átfutás, környezetbarát opció (45/2014. 11. § (1) h)) |
| `panaszkezeles` | Panaszkezelés és jogorvoslat | Fgytv. 17/A., kormányhivatal, illetékes békéltető testület (8 testület, vármegyéből) |
| `impresszum` | Impresszum | Ekertv. 4. § |
| `sutik` | Sütik és helyi tárolás | Nincs követő süti; `bolt-kosar-v1`, `bolt-latott-v1`, `bolt-keresesek-v1` localStorage; Stripe csak kártyás fizetésnél |
| `akadalymentesseg` | Akadálymentességi nyilatkozat | WCAG 2.1 AA cél, mikrovállalkozás-jelzés |

A 45/2014. Korm. rendelet 1–3. mellékletének szövege jogszabályszöveg, **szó szerint** kitöltve (`templates/shared.ts`).

## Kód

- `src/lib/webshop/legal/` — `types`, `constants` (tárhely, platform-adatfeldolgozók, futárok, fizetési módok, vármegyék + cégbíróság, békéltető testületek, NAIH), `derive` (cégforma, vármegye cégjegyzékszámból / irányítószámból), `settings` (nyers bemenet), `context` (`composeLegalContext`, `legalMissing`, `loadLegalContext`), `templates/*`, `render` (`renderLegalDoc`, `hashDoc`), `versions`, `schedule`, `admin`.
- Dokumentum = JSON AST (`LegalDoc` → `LegalSection` → `LegalNode`: p, ul, ol, dl, table, note, h3, form). Inline link: `[felirat](cím)`; a megjelenítő (`components/storefront/legal-doc-view.tsx`) csak `/`, `#`, `http(s)`, `mailto`, `tel` címet enged.
- Forrássorrend: ERP cégadat → webshop felülírás → Bolt beállítások (szállítás, fizetés, visszaküldés, jótállás) → platform konstansok.

## Verziók

A bolt élőben renderel, `sha256(JSON)` ujjlenyomattal. Ha eltér a legutóbbi `webshop_legal_versions` sortól, új verzió készül (`after()` a bolt oldalán; mentéskor `scheduleLegalSync`). Archívum: `/info/<kind>/v/<n>` (noindex). A lap alján „Hatályos: … · N. változat” + korábbi változatok.

## Online elállás (45/2014. 22. § (1a)–(1c))

- Felirat: „Elállás a szerződéstől” (lábléc gomb, mindig látható), megerősítő gomb: „Elállás megerősítése”. Regisztráció nélkül.
- `lib/storefront/withdrawal-actions.ts`: zod, honeypot, IP-hash alapú óránkénti limit (5), `webshop_withdrawals` beszúrás service role-lal, azonnali e-mail a vásárlónak (tartalom + dátum, idő) és értesítés az eladónak.
- A nyilatkozat tartalma trigger-védett (nem módosítható, nincs törlés); csak a kezelési / kézbesítési mezők írhatók.
- E-mail: Resend REST (`lib/email/send.ts`), env `RESEND_API_KEY`, `EMAIL_FROM`. Ha nincs beállítva: `receipt_error` rögzül, a vásárló a képernyőn kapja a visszaigazolást, az admin lista jelzi.

## Admin (Webshop menü)

- **Jogi oldalak** (`/webshop/jogi`): állapot + hiányzó adatok linkkel, oldalak listája verzióval; Eladó adatai (#elado, ERP-ből előtöltve — az ERP-vel egyező értéket nem tároljuk), vármegye (automatikus ajánlás), ügyfélszolgálat, értékesítés (B2C/B2B, egyedi gyártás, kötelező jótállás, hírlevél, mikrovállalkozás), Haladó: saját ÁSZF / adatkezelés URL.
- **Bolt beállítások**: `#szallitas` futárszolgálatok, `#fizetes` fizetési módok + bankszámla + foglalási idő, visszaküldés költsége; a „Garancia” mező önkéntes jótállás.
- **Elállások** (`/webshop/elallasok`): 25/oldal, szűrő (Kezelésre vár / Kezelve / Összes), „Kezeltnek jelölöm”, visszatérítési határidő.
- **Áttekintés**: „Indítás előtt” lista + nyitott elállások jelzése.

## Nyitott tételek

- **EU 2025/1960 harmonizált tájékoztató / címke** (45/2014. 11. § (1a)) — hivatalos, kötött dizájn; külön feladat, nem improvizáljuk.
- Futár- és békéltető testületi adatok évenkénti ellenőrzése (`constants.ts`).
- Egyszeri ügyvédi átnézés a sablonokra; sablonmódosításkor `LEGAL_TEMPLATE_VERSION` emelés (a verziósorba íródik; új verzió a szövegváltozás miatt magától készül).
- ODR link szándékosan nincs (a platform 2025-07-20-án megszűnt).
