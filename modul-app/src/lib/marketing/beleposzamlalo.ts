import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  ChartColumn,
  Clock,
  DoorOpen,
  EyeOff,
  Store
} from 'lucide-react'

/** Belépőszámláló landing — shell copy. */

export const BELEPOSZAMLALO_HERO = {
  eyebrow: 'Egyedi modul · AI kamera',
  title: 'Belépőszámláló — látod, mikor van valódi forgalom',
  body: 'Saját gyártású AI kamera a bejáraton: napi és óránkénti belépőszám. Látszik, melyik órában érdemes embert tartani a pulton.',
  mediaLabel: 'Kép / videó: kamera a bejáraton + forgalmi grafikon'
} as const

export type AddonPain = {
  title: string
  body: string
  Icon: LucideIcon
}

export const BELEPOSZAMLALO_PAINS: AddonPain[] = [
  {
    title: 'Érzésre döntünk',
    body: '„Szerintem kedden üres” — nincs mért adat a forgalomról.',
    Icon: EyeOff
  },
  {
    title: 'Rossz műszakbeosztás',
    body: 'Több ember van bent, amikor nincs vevő — és fordítva.',
    Icon: Clock
  },
  {
    title: 'Kampány hatása láthatatlan',
    body: 'Nem tudod, a akció napján tényleg több ember jött-e be.',
    Icon: ChartColumn
  }
]

export const BELEPOSZAMLALO_FEATURES = [
  {
    title: 'Óránkénti bontás',
    body: 'Látod a nap ívét — mikor van csúcs.',
    Icon: Clock
  },
  {
    title: 'Több bejárat',
    body: 'Ha több ajtó van, külön és összeadva is.',
    Icon: DoorOpen
  },
  {
    title: 'Forgalmi trend',
    body: 'Napok, hetek összehasonlítása.',
    Icon: ChartColumn
  },
  {
    title: 'Saját gyártású AI kamera',
    body: 'Havidíj + egyszeri hardverdíj, árajánlat szerint.',
    Icon: Camera
  }
] as const

export const BELEPOSZAMLALO_AUDIENCE = [
  'Bolti forgalmat mérni akaró kereskedő',
  'Több bejáratos üzlet',
  'Aki a műszakot a forgalomhoz igazítaná',
  'Aki kampány hatását számokkal akarja látni'
] as const

export const BELEPOSZAMLALO_STORE_NOTE: {
  title: string
  body: string
  Icon: LucideIcon
} = {
  title: 'A bolt forgalma, nem a személyek',
  body: 'A számláló a belépéseket méri — nem arcfelismerés, nem azonosítás.',
  Icon: Store
}
