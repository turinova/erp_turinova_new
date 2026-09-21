import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  ClipboardList,
  Factory,
  FileText,
  MessageSquare,
  Package,
  Printer,
  ShoppingCart,
  Store,
  Truck,
  UsersRound
} from 'lucide-react'

/** Hogyan működik — modul szekciók (videó placeholder). */

export type HowItWorksAccent =
  | 'sky'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'emerald'
  | 'indigo'

export type HowItWorksStep = {
  id: string
  title: string
  navLabel: string
  body: string
  bullets: string[]
  package: 'alap' | 'addon' | 'roadmap'
  accent: HowItWorksAccent
  Icon: LucideIcon
  /** YouTube videó ID — null = placeholder. */
  youtubeId: string | null
}

/** Soft tint tokenek — marketing only, nem app-nav. */
export const ACCENT_STYLES: Record<
  HowItWorksAccent,
  {
    chip: string
    chipActive: string
    iconWrap: string
    icon: string
    section: string
    badge: string
    bullet: string
    play: string
    frame: string
  }
> = {
  sky: {
    chip: 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300',
    chipActive: 'border-sky-600 bg-sky-600 text-white hover:border-sky-600',
    iconWrap: 'bg-sky-100 text-sky-700',
    icon: 'text-sky-700',
    section: 'bg-sky-50/60',
    badge: 'border-sky-200 bg-sky-100 text-sky-800',
    bullet: 'bg-sky-500',
    play: 'bg-sky-600 text-white',
    frame: 'border-sky-200 bg-gradient-to-br from-sky-100 to-sky-50'
  },
  amber: {
    chip: 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300',
    chipActive:
      'border-orange-500 bg-orange-500 text-white hover:border-orange-500',
    iconWrap: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-800',
    section: 'bg-amber-50/70',
    badge: 'border-amber-200 bg-amber-100 text-amber-900',
    bullet: 'bg-orange-500',
    play: 'bg-orange-500 text-white',
    frame: 'border-amber-200 bg-gradient-to-br from-amber-100 to-orange-50'
  },
  violet: {
    chip: 'border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-300',
    chipActive:
      'border-violet-600 bg-violet-600 text-white hover:border-violet-600',
    iconWrap: 'bg-violet-100 text-violet-700',
    icon: 'text-violet-700',
    section: 'bg-violet-50/60',
    badge: 'border-violet-200 bg-violet-100 text-violet-800',
    bullet: 'bg-violet-500',
    play: 'bg-violet-600 text-white',
    frame: 'border-violet-200 bg-gradient-to-br from-violet-100 to-violet-50'
  },
  rose: {
    chip: 'border-rose-200 bg-rose-50 text-rose-950 hover:border-rose-300',
    chipActive: 'border-rose-500 bg-rose-500 text-white hover:border-rose-500',
    iconWrap: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-700',
    section: 'bg-rose-50/60',
    badge: 'border-rose-200 bg-rose-100 text-rose-800',
    bullet: 'bg-rose-500',
    play: 'bg-rose-500 text-white',
    frame: 'border-rose-200 bg-gradient-to-br from-rose-100 to-rose-50'
  },
  emerald: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-300',
    chipActive:
      'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-600',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-700',
    section: 'bg-emerald-50/60',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    bullet: 'bg-emerald-500',
    play: 'bg-emerald-600 text-white',
    frame: 'border-emerald-200 bg-gradient-to-br from-emerald-100 to-emerald-50'
  },
  indigo: {
    chip: 'border-indigo-200 bg-indigo-50 text-indigo-950 hover:border-indigo-300',
    chipActive:
      'border-indigo-600 bg-indigo-600 text-white hover:border-indigo-600',
    iconWrap: 'bg-indigo-100 text-indigo-700',
    icon: 'text-indigo-700',
    section: 'bg-indigo-50/60',
    badge: 'border-indigo-200 bg-indigo-100 text-indigo-800',
    bullet: 'bg-indigo-500',
    play: 'bg-indigo-600 text-white',
    frame: 'border-indigo-200 bg-gradient-to-br from-indigo-100 to-indigo-50'
  }
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: 'keszlet',
    title: 'Készletkezelés',
    navLabel: 'Készlet',
    body: 'Raktáranként látod, mi van bent. Bevételezés, kiadás és átadás ugyanott fut, minden mozgás visszakereshető.',
    bullets: [
      'Több raktár, egy rendszer',
      'Mozgásnapló tételenként',
      'Áttárolás a boltok között'
    ],
    package: 'alap',
    accent: 'sky',
    Icon: Package,
    youtubeId: null
  },
  {
    id: 'beszerzes',
    title: 'Beszerzés',
    navLabel: 'Beszerzés',
    body: 'A beszállítói rendeléstől a beérkezésig egy folyamat. Ami megérkezik, azonnal növeli a készletet — nincs külön Excel.',
    bullets: [
      'Rendelés → beérkezés → készlet',
      'Beszállítók és rendeléstörténet',
      'Részleges beérkezés is kezelhető'
    ],
    package: 'alap',
    accent: 'sky',
    Icon: Truck,
    youtubeId: null
  },
  {
    id: 'pos',
    title: 'Online POS',
    navLabel: 'POS',
    body: 'Pénztárfelület műszaknyitással és zárással. Az eladás azonnal lejön a raktári készletből.',
    bullets: [
      'Vonalkód-first pult',
      'Műszak nyitás / zárás',
      'Készpénz és kártya'
    ],
    package: 'alap',
    accent: 'amber',
    Icon: Store,
    youtubeId: null
  },
  {
    id: 'arajanlat',
    title: 'Árajánlat',
    navLabel: 'Árajánlat',
    body: 'Méret, anyag, ár — egy helyen. Az ajánlat percek alatt kész, nem táblázatból másolva.',
    bullets: [
      'Piszkozat → kiküldés → státusz',
      'Ügyfélhez kötött ajánlatok',
      'Később eladásba vihető'
    ],
    package: 'alap',
    accent: 'amber',
    Icon: FileText,
    youtubeId: null
  },
  {
    id: 'cimke',
    title: 'Bolti címkenyomtatás',
    navLabel: 'Címke',
    body: 'Polc- és termékcímke közvetlenül a törzsadatokból, vonalkóddal — a bolt mindennapi része.',
    bullets: [
      '33×25 mm polccímke',
      'Vonalkód a termékből',
      'Nyomtatás a terméklistáról'
    ],
    package: 'alap',
    accent: 'sky',
    Icon: Printer,
    youtubeId: null
  },
  {
    id: 'szamlazas',
    title: 'Számlázás',
    navLabel: 'Számlázás',
    body: 'Számla közvetlenül az eladásból, ismételt adatrögzítés nélkül. Az ügyfél- és tételadatok már megvannak.',
    bullets: [
      'Eladásból indított számla',
      'Nincs kétszer rögzített sor',
      'Visszakereshető bizonylat'
    ],
    package: 'alap',
    accent: 'amber',
    Icon: Banknote,
    youtubeId: null
  },
  {
    id: 'lapszabaszat',
    title: 'Lapszabászati gyártó',
    navLabel: 'Lapszabászat',
    body: 'Táblás és szálas anyag optimalizálása élzárással és szabásjegyzékkel. A méretek a megrendelésből jönnek.',
    bullets: [
      'Opti szabás',
      'Élzáró és anyaglista',
      'Megrendelés → gyártás'
    ],
    package: 'addon',
    accent: 'violet',
    Icon: Factory,
    youtubeId: null
  },
  {
    id: 'sms',
    title: 'SMS értesítések',
    navLabel: 'SMS',
    body: 'Automatikus üzenet az ügyfélnek, amint elkészült az ajánlata. Nem kell utána telefonálni.',
    bullets: [
      'Sablon szövegek',
      'Küldés az ajánlat állapotából',
      'Naplózott kiküldések'
    ],
    package: 'addon',
    accent: 'rose',
    Icon: MessageSquare,
    youtubeId: null
  },
  {
    id: 'partner',
    title: 'Partner portál',
    navLabel: 'Partner',
    body: 'Asztalos partnerek saját portálon rendelnek. Te a saját rendszeredben látod a beérkező igényeket.',
    bullets: [
      'Partner saját belépővel',
      'Rendelés online',
      'Nincs e-mailes káosz'
    ],
    package: 'addon',
    accent: 'rose',
    Icon: Store,
    youtubeId: null
  },
  {
    id: 'jelenlet',
    title: 'Jelenléti ív',
    navLabel: 'Jelenlét',
    body: 'Munkanapok és távollétek vezetése dolgozónként, beléptető eszköz nélkül is.',
    bullets: [
      'Dolgozók és típusok',
      'Manuális jelenléti ív',
      'Munkarend naptár'
    ],
    package: 'addon',
    accent: 'emerald',
    Icon: ClipboardList,
    youtubeId: null
  },
  {
    id: 'belepo',
    title: 'Belépőszámláló',
    navLabel: 'Belépők',
    body: 'Napi és óránkénti látogatószám a boltban. Látszik, mikor van valódi forgalom.',
    bullets: [
      'Óránkénti bontás',
      'Több bejárat',
      'Forgalmi trend'
    ],
    package: 'addon',
    accent: 'emerald',
    Icon: UsersRound,
    youtubeId: null
  },
  {
    id: 'webshop',
    title: 'Webshop kapcsolat',
    navLabel: 'Webshop',
    body: 'A webáruház és a bolt ugyanazt a készletet használja. A webes rendelés is itt jelenik meg.',
    bullets: [
      'Közös készlet',
      'Webes rendelés a rendszerben',
      'Nincs kétszer vezetett stock'
    ],
    package: 'roadmap',
    accent: 'indigo',
    Icon: ShoppingCart,
    youtubeId: null
  }
]

export const PACKAGE_LABEL: Record<HowItWorksStep['package'], string> = {
  alap: 'Alap',
  addon: 'Add-on',
  roadmap: 'Hamarosan'
}
