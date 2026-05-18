/**
 * Homepage content tables.
 *
 * Centralised so the home page composition stays declarative.
 *
 * Image placeholders below use existing site photos so the page renders
 * immediately. Once curated homepage photos are ready, drop them at
 * /public/img/home/<name>.webp and update the paths flagged with TODO.
 * Recommended sizes:
 *   - hero:              1920×1080 WebP
 *   - service pillar:     800×600  WebP (4:3)
 *   - showroom storefront: 1200×800 WebP (3:2)
 *   - final CTA bg:      1920×600  WebP (optional)
 */

import type { FaqItem } from "@/components/szallitolada-keszites/FaqAccordion"

// ────────────────────────────────────────────────────────────────────────────
// HERO
// ────────────────────────────────────────────────────────────────────────────

export const HOME_HERO_IMAGE = {
  src: "/img/dji_fly_20240207_110546_294_1707300361781_photo_optimized.JPG.webp",
  alt: "A Hírös-Ablak Kft. faipari üzeme és áruháza Kecskeméten, drónfelvétel",
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE PILLARS — top of homepage, 3 cards
// ────────────────────────────────────────────────────────────────────────────

export type ServicePillar = {
  href: string
  label: string
  title: string
  description: string
  cta: string
  image: string
  imageAlt: string
  bullets: readonly string[]
}

export const HOME_SERVICE_PILLARS: readonly ServicePillar[] = [
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "01 · Szolgáltatás",
    title: "Méretre vágva, élzárva",
    description:
      "Bútorlap, munkalap, hátfal méretre vágva, élzárva, átvételre készen. Optimalizált táblafelosztás; a megmunkálást a nálunk vásárolt anyagra vállaljuk.",
    cta: "Részletek",
    image: "/img/BIESSE_SELCO_10660_oriz.jpg",
    imageAlt: "Automata táblafelosztó, lapszabászat műhely a Hírös-Ablak üzemében",
    bullets: [
      "ABS, élfólia, élléc, élfurnér élzárás",
      "Munkalap megmunkálás, pánthelyfúrás",
      "Raktári anyag: 3–5 munkanap, SMS készre",
    ],
  },
  {
    href: "/butorlap",
    label: "02 · Anyagkatalógus",
    title: "Találja meg a dekort",
    description:
      "Raktáron vagy beszerezhető bútorlapok egy katalógusban. Vastagság, márka, csoport és készlet szerint szűrhet; kérésre méretre vágjuk és élzárjuk.",
    cta: "Katalógus",
    image: "/img/egger_edc2020_heroshot.webp",
    imageAlt: "Egger bútorlap dekor kollekció",
    bullets: [
      "Raktáron vagy beszerezhető jelölés",
      "Szűrés márka, vastagság, csoport szerint",
      "Méretre vágás és élzárás kérésre",
    ],
  },
  {
    href: "/barkacsaruhaz-kecskemet",
    label: "03 · Üzletünk",
    title: "Áruház 500 m²-en",
    description:
      "Vasalat, mosogató, csaptelep, fogantyú, LED, szerszám: minden a bútorgyártáshoz, egy üzletben. Bizonytalan a választásban? Szakember segít.",
    cta: "Üzletünk",
    image: "/img/bemutato_hero.jpg",
    imageAlt: "Hírös-Ablak 500 m²-es bemutatótereme Kecskeméten",
    bullets: [
      "500 m² bemutatóterem",
      "Vasalat raktárról",
      "H–P 8–17, Szo 8–12",
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────
// PROCESS — 4-step horizontal timeline
// ────────────────────────────────────────────────────────────────────────────

export type ProcessStep = {
  number: string
  title: string
  description: string
}

export const HOME_PROCESS: readonly ProcessStep[] = [
  {
    number: "01",
    title: "Választás",
    description:
      "Online böngészi a katalógust, vagy bejön és kézbe veszi. Ha kérdés van, szakember válaszol. Időpont sem kell.",
  },
  {
    number: "02",
    title: "Az ár",
    description:
      "2 percen belül látja, mibe kerül. Nincs „majd kiderül”, nincs becsült ár. Asztalosnak külön kedvezmény.",
  },
  {
    number: "03",
    title: "Gyártás",
    description:
      "Saját gépeken, kiszámítható ütemmel: 3–5 munkanap. Amikor elkészül, SMS-t küldünk. Nem kell érdeklődnie.",
  },
  {
    number: "04",
    title: "Átvétel",
    description:
      "Személyesen Kecskeméten, a Mindszenti körút 10. szám alatt. A paneleket raklapra rakva, összepakolva adjuk át.",
  },
]

// ────────────────────────────────────────────────────────────────────────────
// SHOWROOM INVITE
// ────────────────────────────────────────────────────────────────────────────

// TODO: replace with /img/home/storefront.webp
export const HOME_SHOWROOM_PHOTO = {
  src: "/img/kapcsolat_hero.jpg",
  alt: "Hírös-Ablak Faipari Áruház és bemutatóterem, Kecskemét, Mindszenti krt. 10.",
}

export const HOME_SHOWROOM_BULLETS: readonly string[] = [
  "500 m² bemutatóterem, minták és szakértelem helyben",
  "Saját lapszabászat és élzárás, egy üzletben",
  "Vasalat, mosogató, csaptelep raktárról",
  "Nyitva: hétköznap 8–17, szombaton 8–12",
]

// ────────────────────────────────────────────────────────────────────────────
// FAQ
// ────────────────────────────────────────────────────────────────────────────

export const HOME_FAQ: readonly FaqItem[] = [
  {
    q: "Mennyibe kerül?",
    a: "Az ár a választott alapanyagtól (márka, dekor, vastagság), a darabolási listától és az élzárás mennyiségétől függ. A Turinova rendszerben 2 percen belül látja a végösszeget.",
  },
  {
    q: "Mikor lesz kész?",
    a: "Raktári anyagból 3–5 munkanapon belül dolgozzuk le. SMS-t küldünk, amint kész. A pontos napot az ajánlatban közöljük.",
  },
  {
    q: "Hogyan tudok rendelni?",
    a: "Személyesen az áruházban, e-mailben, vagy online a Turinova rendszerben. Megadja az anyagot, a méreteket és az élzárást; mi elkészítjük az árajánlatot.",
  },
  {
    q: "Hol tudom átvenni?",
    a: "Személyesen Kecskeméten, a Mindszenti körút 10. szám alatt. A paneleket raklapra rakva, összepakolva adjuk át.",
  },
  {
    q: "Milyen élzárással dolgoznak?",
    a: "ABS (0,4 / 1 / 2 mm, matt vagy fényes), élfólia, élléc és élfurnér. A forgalmazott márkákhoz színazonos ABS és élfólia élanyagot biztosítunk.",
  },
  {
    q: "Vehetek csak 1 darabot?",
    a: "Igen. Akár 1 darab bútorlapot is vágunk. Vasalatot, ragasztót, élzárót 1 darabos kiszerelésben is megvehet az áruházban.",
  },
  {
    q: "Lehet hozott anyagot szabni?",
    a: "Jelenleg nem. A megmunkálást a nálunk vásárolt bútorlapra és munkalapra vállaljuk.",
  },
  {
    q: "Mi van, ha a dekor nincs raktáron?",
    a: "Beszerezzük. A katalógusban „Raktáron” vagy „Beszerezhető” jelzéssel látja a státuszt. A beszerzési időt az ajánlatban közöljük.",
  },
  {
    q: "Mi a lapszabászat?",
    a: "A kiválasztott bútorlapot, munkalapot vagy hátfalat pontos méretre vágjuk, a megadott éleken élzárjuk, kérésre pánthelyet fúrunk. Saját üzemünkben automata táblafelosztó és élzáró gépeken dolgozunk, optimalizált táblafelhasználással.",
  },
  {
    q: "Be kell mennem az üzletbe?",
    a: "Nem feltétlen. Online kalkulálhat és beküldheti a rendelést. Ha mintát vagy tanácsot szeretne, szívesen várjuk Kecskeméten.",
  },
  {
    q: "Asztalos vagyok, kapok kedvezményt?",
    a: "Igen, az asztalos partnerprogrammal. Belépő kedvezmény az első rendeléstől, magasabb szint havi kvóta teljesítésével. Részletek az asztalos partner oldalon.",
  },
]

// ────────────────────────────────────────────────────────────────────────────
// HERO PROMISES — identity / authority card next to the headline
// Stripe / Notion-style: status statements (not process instructions).
// Icons are rendered in page.tsx.
// ────────────────────────────────────────────────────────────────────────────

export type HeroPromiseIcon = "home" | "cog" | "users"

export type HeroPromise = {
  icon: HeroPromiseIcon
  text: string
}

export const HOME_HERO_PROMISES: readonly HeroPromise[] = [
  { icon: "home", text: "1996 óta ugyanitt, családi vállalkozás" },
  { icon: "cog", text: "Saját üzem, saját raktár, saját szakemberek" },
  { icon: "users", text: "Magánszemélyeknek és asztalosoknak egyaránt" },
]

// ────────────────────────────────────────────────────────────────────────────
// HERITAGE STORY — editorial section + stats grid
// ────────────────────────────────────────────────────────────────────────────

// TODO: replace with a strong editorial workshop / storefront photo when ready
export const HOME_HERITAGE_PHOTO = {
  src: "/img/kapcsolat_hero.jpg",
  alt: "Hírös-Ablak Faipari Áruház, Kecskemét, Mindszenti krt. 10.",
}

export const HOME_HERITAGE_STORY: readonly string[] = [
  "Családi vállalkozásként 1996-ban indultunk Kecskeméten, a Mindszenti körút 10. szám alatt. Egyetlen célunk volt: ne kelljen külön helyre menni bútorlapért, élzárásért és vasalatért.",
  "Harminc év alatt 1500 m²-es saját üzemmé és 500 m²-es bemutatóteremmé nőttünk, ugyanazon a címen. Lakossági vásárlóinknak és asztalos partnereinknek ma is egy helyen adjuk az anyagot, a lapszabászatot, a vasalatot és a személyes szakmai tanácsot.",
]

export type HeritageStat = { number: string; label: string }

export const HOME_HERITAGE_STATS: readonly HeritageStat[] = [
  { number: "1996", label: "cégalapítás éve" },
  { number: "30 év", label: "egy helyen Kecskeméten" },
  { number: "1500 m²", label: "saját üzem és gépek" },
  { number: "500 m²", label: "bemutatóterem" },
]
