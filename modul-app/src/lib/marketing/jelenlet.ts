import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  CalendarCheck,
  CreditCard,
  FileDown,
  FileSpreadsheet,
  PlaneTakeoff,
  Smartphone,
  Timer,
  Users
} from 'lucide-react'

/** Jelenléti ív landing — a modul valós funkcióira épülő copy. */

export const JELENLET_HERO = {
  eyebrow: 'Egyedi modul · opcionális hardver',
  title: 'Jelenléti ív, amit a hónap végén aláírásra készen adsz ki',
  body: 'Havi naptárban rögzíted, ki mikor érkezett és távozott. A hónap végén egy kattintással hivatalos, céglogós PDF készül — egy dolgozóra vagy az egész csapatra.'
} as const

export type AddonPain = {
  title: string
  body: string
  Icon: LucideIcon
}

export const JELENLET_PAINS: AddonPain[] = [
  {
    title: 'Papír jelenléti ív',
    body: 'A hónap végén valakinek kézzel kell összefűznie a napokat.',
    Icon: CalendarDays
  },
  {
    title: '„Kérdezd meg a műszakvezetőt”',
    body: 'Nincs egy hely, ahol látszik, ki volt bent és mennyit.',
    Icon: Users
  },
  {
    title: 'Excelen múlik a nyilvántartás',
    body: 'Minden hónapban újra összeáll a tábla, és újra elcsúszik egy-két nap.',
    Icon: FileSpreadsheet
  },
  {
    title: 'Hardver nélkül is kell',
    body: 'Nem minden telephelyen van beléptető — a szoftver önmagában is működik.',
    Icon: Smartphone
  }
]

export type AddonFeature = {
  title: string
  body: string
  Icon: LucideIcon
}

export const JELENLET_FEATURES: AddonFeature[] = [
  {
    title: 'Havi naptár egy képernyőn',
    body: 'Az érkezés és a távozás minden napra kiírva. Ami kimaradt, azt a rendszer külön jelöli.',
    Icon: CalendarDays
  },
  {
    title: 'Hivatalos PDF',
    body: 'Céglogóval, aláírásra készen. Egy dolgozóra vagy az egész csapatra, ZIP-ben.',
    Icon: FileDown
  },
  {
    title: 'Ünnepek egy gombbal',
    body: 'A magyar nemzeti ünnepek és az áthelyezett napok betölthetők az egész évre.',
    Icon: CalendarCheck
  },
  {
    title: 'Szabadság és betegszabadság',
    body: 'Szabadság, betegszabadság, fizetés nélküli és egyéb távollét külön típusként.',
    Icon: PlaneTakeoff
  },
  {
    title: 'Túlóra-szabály dolgozónként',
    body: 'Türelmi idő a műszak után és napi maximum percben, dolgozónként.',
    Icon: Timer
  },
  {
    title: 'Opcionális chipkártya',
    body: 'Saját gyártású olvasó a bejáratra. Egyszeri hardverdíj, árajánlat szerint.',
    Icon: CreditCard
  }
]

export const JELENLET_PDF_HIGHLIGHT = {
  title: 'A hónap végén nem Excelt küldesz, hanem aláírásra kész PDF-et',
  body: 'Kijelölöd a dolgozókat, kiválasztod a hónapot, és letöltöd. Egy dolgozónál PDF, többnél ZIP. A fejlécben a céged logója, a napok mellett a ledolgozott órák és a távollétek.',
  points: [
    'Céglogó a fejlécben',
    'Ünnepek és távollétek jelölve',
    'Összesített óra és munkanap',
    'Tömeges letöltés ZIP-ben'
  ]
} as const

export const JELENLET_TERMINAL = {
  title: 'Chipkártya a bejáraton, ha kell',
  body: 'A dolgozó a kártyát a terminálhoz érinti, a képernyő pedig kiírja a nevét és az időt. A készülék internet nélkül is rögzít, és amikor visszajön a hálózat, magától feltölti az adatokat.',
  points: [
    'Érkezés és távozás egy érintéssel',
    'Négyjegyű PIN, ha a kártya otthon maradt',
    'Offline is rögzít, utána szinkronizál',
    'A hardver egyszeri díj, árajánlat szerint'
  ]
} as const

export type AudienceCase = {
  title: string
  body: string
}

export const JELENLET_AUDIENCE: AudienceCase[] = [
  {
    title: 'Nincs kontroll a jelenléti ív felett',
    body: 'A papírt utólag bárki kitölti, és hó végén már nem emlékszik senki a pontos napokra. Itt naponta rögzítve van, és látszik, hol maradt ki.'
  },
  {
    title: 'A vezető nem látja, ki mikor jött és ment',
    body: 'Reggel nem derül ki, ki van bent, hó végén meg az sem, hogy ki mennyit dolgozott. A naptárban mindkettő egy képernyőn van.'
  },
  {
    title: 'Beléptetőrendszerre nincs több százezer',
    body: 'Egy telephely átépítése kapukkal és olvasókkal komoly beruházás. Ez a modul hardver nélkül indul, és ha később mégis kell, jön hozzá a chipkártyás olvasó.'
  },
  {
    title: 'Több helyen dolgoznak az emberek',
    body: 'Műhely, bolt, kiszállítás. Egy naptárban van mind, nem három füzetben és két Excelben.'
  }
]
