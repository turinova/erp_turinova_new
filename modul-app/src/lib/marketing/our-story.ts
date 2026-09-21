import type { LucideIcon } from 'lucide-react'
import {
  Factory,
  FileSpreadsheet,
  Handshake,
  MessageSquare,
  Store,
  Timer,
  Wrench
} from 'lucide-react'

import type { HowItWorksAccent } from '@/lib/marketing/how-it-works'

/** A történetünk — termék storyline fejezetek (placeholder copy). */

export type StoryChapter = {
  id: string
  navLabel: string
  year: string
  title: string
  body: string
  bullets?: string[]
  chips?: string[]
  quote?: { text: string; attribution: string }
  accent: HowItWorksAccent
  Icon: LucideIcon
  /** Speciális blokk a szekcióban. */
  variant: 'story' | 'stats' | 'today'
}

export const OUR_STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'kezdet',
    navLabel: 'Kezdet',
    year: '2019',
    title: 'Egy gyártó, aki Excelben fulladt',
    body: 'A Hírös Ablaknál a rendelés, az anyagár és az ügyfélhívás ugyanarra a napra esett. A táblázatok működtek — amíg hárman nem nyúltak ugyanahhoz a fájlhoz.',
    bullets: [
      'Kecskemét, ablakos gyártás',
      'Ajánlat és műhely külön világ',
      'Ugyanaz a nap, háromféle „igazság”'
    ],
    accent: 'sky',
    Icon: FileSpreadsheet,
    variant: 'story'
  },
  {
    id: 'fajdalom',
    navLabel: 'Fájdalom',
    year: '2020',
    title: 'Az idő nem adminisztráció volt',
    body: 'Egy ajánlat fél óra. A gyártás szervezése fél nap. Az ügyfél SMS helyett telefon. Ami kimaradt a rendszerből, az a műhelyben és a forgalomban jelent meg.',
    chips: ['Dupla rögzítés', 'Készlet bizonytalan', 'Partner e-mailben'],
    bullets: [
      'Havonta több tucat ajánlat',
      'Gyakori ár- és anyagváltozás',
      'Az ügyfél a visszahívásra várt'
    ],
    accent: 'amber',
    Icon: Timer,
    variant: 'story'
  },
  {
    id: 'elso-verzio',
    navLabel: 'Első verzió',
    year: '2021',
    title: 'Először magunknak építettünk',
    body: 'Nem „MVP demó”, hanem napi munkaasztal: ami reggel bejött ajánlatként, azt délután a műhelynek is látnia kellett. Ha nálunk nem állta meg, nem került tovább.',
    quote: {
      text: 'Ha a saját boltunkban nem használjuk, másnak se adjuk.',
      attribution: 'Hírös Ablak — belső döntés'
    },
    bullets: [
      'Belső tool, nem prezentációs demó',
      'Napi használat a teszter',
      'Ami nem ment, azt kidobtuk'
    ],
    accent: 'violet',
    Icon: Wrench,
    variant: 'story'
  },
  {
    id: 'bolt',
    navLabel: 'Bolt',
    year: '2023',
    title: 'A pult és a raktár egy adatra állt',
    body: 'Bevételezés, eladás, címke, pénztár — ugyanaz a készlet. A cél az volt, hogy a boltban ne kelljen „utánaírni” a rendszernek.',
    chips: ['Készlet', 'Beszerzés', 'POS', 'Címke'],
    bullets: [
      'Beérkezés azonnal növeli a stockot',
      'POS műszakkal, nem füzetből',
      'Címke a törzsadatból'
    ],
    accent: 'amber',
    Icon: Store,
    variant: 'story'
  },
  {
    id: 'muhely',
    navLabel: 'Műhely',
    year: '2024',
    title: 'A méret a megrendelésből jött, nem újraírva',
    body: 'A szabás és az anyaglista onnan indult, ahol az ügyfél igénye már megvolt. Kevesebb újrarajzolás, kevesebb „melyik a friss fájl”.',
    chips: ['Lapszabászat', 'Opti', 'Élzáró'],
    bullets: [
      'Megrendelés → szabásjegyzék',
      'Táblás és szálas anyag',
      'Kevesebb kézi átmásolás'
    ],
    accent: 'violet',
    Icon: Factory,
    variant: 'story'
  },
  {
    id: 'partnerek',
    navLabel: 'Partnerek',
    year: '2025',
    title: 'Az asztalos és az ügyfél is a folyamat része lett',
    body: 'Partnerportál a rendeléshez, SMS amikor kész az ajánlat. Kevesebb „írtam már?” — több kiszámítható nap.',
    chips: ['Partner portál', 'SMS'],
    bullets: [
      'Partner saját belépővel rendel',
      'Ügyfél értesítés sablonból',
      'Naplózott kiküldések'
    ],
    accent: 'rose',
    Icon: MessageSquare,
    variant: 'story'
  },
  {
    id: 'szamok',
    navLabel: 'Számok',
    year: 'Ma',
    title: 'Amit a mindennapokban mértünk',
    body: 'Ugyanaz a megtérülés-képlet, mint a nyilvános kalkulátorban. Becslés a Hírös Ablak kalibrációjával — nem szerződéses garancia.',
    accent: 'emerald',
    Icon: Handshake,
    variant: 'stats'
  },
  {
    id: 'ma',
    navLabel: 'Ma',
    year: '2026',
    title: 'Ugyanaz a rendszer, amit más gyártóknak is adunk',
    body: 'Az Alap csomag a bolt magja: eladás, készlet, beszerzés, POS, címke. A lapszabászat, a jelenlét, a partner és az SMS akkor kapcsol be, ha a folyamatodhoz kell.',
    bullets: [
      'Először a ti folyamataitok',
      'Modulok, nem mindent ragasztó csomag',
      'A történet nálatok folytatódik'
    ],
    accent: 'indigo',
    Icon: Handshake,
    variant: 'today'
  }
]
