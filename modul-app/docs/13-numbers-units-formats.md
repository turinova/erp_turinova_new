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

- Listaoszlop fejlécében jelenjen meg a pénznem: `Nettó ár (Ft)`
- Ne ismételd minden cellában a `Ft`-ot, ha az oszlop egységes
- Nettó / bruttó alapnézet modulonként legyen rögzítve, ne esetleges

## 4. ÁFA

- Az ÁFA ne csak százalék legyen, hanem emberileg érthető megnevezés is, ahol kell
- Ha nettó és bruttó együtt látszik, a különbség legyen egyértelmű

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
