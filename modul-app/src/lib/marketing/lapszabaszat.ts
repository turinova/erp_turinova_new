/** Lapszabászati landing — ügyvezető fájdalom → megoldás. Emberi, konkrét magyar. */

export const LAPSZABASZAT_HERO = {
  title: 'Lapszabászati ajánlat 10 perc alatt, nem két hét alatt.',
  body:
    'Az asztalos a saját fiókjában adja meg a méreteket és az élzárást, és a ti áraitokkal azonnal látja a végösszeget. Hozzátok kész szabásjegyzék érkezik, és amikor elkészül a rendelés, a partner automatikusan SMS-t kap. Ma több mint 500 asztalos rendel így.',
  primaryCta: 'Jelentkezem a várólistára',
  secondaryCta: 'Így működik'
} as const

export const LAPSZABASZAT_SCENE_TITLE = 'Miért építettük meg'

export const LAPSZABASZAT_SCENE =
  'Egy péntek délelőtt háromszor hívtak fel ugyanazzal a kérdéssel: „Kész van már a konyha?” A pultnál senki nem tudta megmondani. Ma a partner a fiókjában látja, hol tart a rendelése, és SMS-t kap, amikor elkészült. A telefon azóta jóval ritkábban csörög.'

export type LapszabaszatPain = {
  before: string
  after: string
}

export const LAPSZABASZAT_PAINS: LapszabaszatPain[] = [
  {
    before:
      'Egy ajánlat 1–2 hétig készül. Egy műszaki kolléga egész nap ajánlatokat számol, a többi rendelés addig vár.',
    after:
      'A partner azonnal látja a nettó árat. Egy ajánlat összeállítása kb. 10 perc.'
  },
  {
    before:
      'A méretek e-mailben vagy papíron érkeznek. Ti begépelitek, aztán a műhely még egyszer.',
    after:
      'A méreteket egyszer, a partner rögzíti, és változatlanul jutnak el a gyártásig. Nincs újragépelés, nincs vita a ráhagyásról.'
  }
]

export type LapszabaszatStep = {
  title: string
  body: string
}

export const LAPSZABASZAT_FLOW_TITLE = 'A megrendeléstől az átadásig'
export const LAPSZABASZAT_FLOW_INTRO =
  'A partner és a műhely ugyanazt az adatot látja. Nincs külön Excel-táblázat.'

export const LAPSZABASZAT_STEPS: LapszabaszatStep[] = [
  {
    title: 'A partner leadja a rendelést',
    body:
      'Megadja a méreteket és az élzárást, és azonnal látja a bruttó árat. Akár éjjel is leadhatja.'
  },
  {
    title: 'Gyártásba adás egy lépésben',
    body:
      'Beérkezik a rendelés: kiválasztjátok a gépet és a gyártási napot, megadjátok a vonalkódot, és már gyártásban is van. A méreteket senki nem gépeli újra.'
  },
  {
    title: 'Készre jelölés és SMS',
    body:
      'Beolvassátok a vonalkódot, a rendelés készre vált, a partner pedig automatikusan SMS-t kap.'
  }
]

export const LAPSZABASZAT_STATS_TITLE = 'Számok éles használatból'
export const LAPSZABASZAT_STATS_INTRO =
  'Valós rendelések, nem bemutató adat.'

export const LAPSZABASZAT_STATS = [
  {
    value: '5000+',
    label: 'elkészült ajánlat',
    hint: 'valós rendelésekből'
  },
  {
    value: '500+',
    label: 'regisztrált partner',
    hint: 'asztalosok, akik így rendelnek'
  },
  {
    value: 'kb. 10 perc',
    label: 'egy ajánlat elkészítése',
    hint: 'korábban 1–2 hét'
  },
  {
    value: 'kb. 210 óra/hó',
    label: 'becsült megtakarított munkaidő',
    hint: 'a mi forgalmunk alapján, nálatok eltérhet'
  }
] as const

export type LapszabaszatAudience = {
  title: string
  body: string
}

export const LAPSZABASZAT_AUDIENCE_TITLE = 'Ha ez ismerős'

export const LAPSZABASZAT_AUDIENCE: LapszabaszatAudience[] = [
  {
    title: 'Lapszabászatot működtettek, és asztalosok rendelnek tőletek',
    body:
      'Ők napokig várnak az ajánlatra, ti pedig minden méretet kétszer gépeltek be.'
  },
  {
    title: 'Egy cégen belül működik a bolt és a műhely',
    body:
      'A pultnál felveszik a rendelést, a műhelyben vágnak. Ami eddig a kettő között elveszett, az most egy helyen marad.'
  }
]

/** Adatelkülönítés – versenytárs-félelem kezelése. */
export const LAPSZABASZAT_PRIVACY = {
  title: 'A ti adataitok a tiétek.',
  body:
    'A partnereitek, áraitok és rendeléseitek csak nálatok látszanak. Mi nem férünk hozzájuk, és nem adjuk tovább őket.'
} as const

export const LAPSZABASZAT_HANDOVER = {
  title: 'Átadás a pultnál',
  body:
    'Átvételi elismervény, aláírás, és kész. Senkinek nem kell fejben tartania, ki mit vihet el.'
} as const

export const LAPSZABASZAT_CTA = {
  title: 'Várólista · Indulás 2027 második negyedévében',
  body:
    'Add meg a neved és a telefonszámod. Az indulás előtt személyesen felhívunk. Reklámot nem küldünk.',
  button: 'Jelentkezem'
} as const

export const LAPSZABASZAT_FOOTER_BLURB =
  'Ajánlat, gyártás és bolt egy rendszerben. Magyar lapszabászatoknak és kereskedőknek.'
