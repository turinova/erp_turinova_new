import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  Clock,
  CloudRain,
  DoorOpen,
  EyeOff,
  LayoutDashboard,
  Megaphone,
  Store,
  TrendingUp
} from 'lucide-react'

import {
  BUSIEST_WEEKDAY,
  CAMPAIGN_BASELINE_DAY,
  CAMPAIGN_DAY,
  DRY_BUCKET,
  formatCount,
  HEATMAP_PEAK,
  MONTH_AVG_IN,
  MONTH_TOTAL_IN,
  OPEN_DAYS,
  RAIN_BUCKET,
  SEASON_BEST,
  SEASON_WORST,
  WEEKDAY_PROFILE
} from '@/lib/marketing/beleposzamlalo-demo-data'

/**
 * Belépőszámláló landing — copy.
 * A számok a `beleposzamlalo-demo-data` demo hónapból származnak, hogy a
 * szöveg és a chartok ne mondhassanak mást.
 */

export const BELEPOSZAMLALO_HERO = {
  eyebrow: 'Belépőszámláló · kamera a bejáratnál',
  title: 'Lásd, mikor hányan térnek be az üzletedbe.',
  body: 'A kassza az eladásokat mutatja. A belépőszámláló azt is megmutatja, hány látogató érkezett az üzletbe, és mely órákban volt a legnagyobb a látogatottság. Az időjárási bontásból az is látszik, hogyan alakult a belépésszám esős vagy szeles napokon.'
} as const

export type AddonPain = {
  title: string
  body: string
  Icon: LucideIcon
}

export const BELEPOSZAMLALO_PAINS: AddonPain[] = [
  {
    title: 'Mikor érkeznek a látogatók',
    body: 'Az eladásokból nem derül ki, hogy délelőtt, ebédidőben vagy zárás előtt volt-e a legnagyobb a látogatottság.',
    Icon: EyeOff
  },
  {
    title: 'Mikor kell több kolléga',
    body: 'Óránkénti adatok nélkül a beosztás többnyire tapasztalat és becslés alapján készül.',
    Icon: Clock
  },
  {
    title: 'Hozott-e látogatókat a kampány',
    body: 'A belépésszámból látszik, hogy egy akció vagy hirdetés idején többen tértek-e be az üzletbe.',
    Icon: Megaphone
  },
  {
    title: 'Mennyit számít az időjárás',
    body: 'Az esős és szeles napok külön összehasonlíthatók a csapadékmentes napokkal.',
    Icon: CloudRain
  }
]

export type AddonFeature = {
  title: string
  body: string
  Icon: LucideIcon
}

export const BELEPOSZAMLALO_FEATURES: AddonFeature[] = [
  {
    title: 'Belépésszám óránként',
    body: 'Külön látod a be- és kilépéseket, valamint a nap legerősebb időszakait.',
    Icon: Clock
  },
  {
    title: 'Mai látogatottság a főoldalon',
    body: 'Az aktuális belépésszám, a becsült létszám és a csúcsóra rögtön látható.',
    Icon: LayoutDashboard
  },
  {
    title: 'Napi és havi összehasonlítás',
    body: 'Összevetheted a napokat és a hónapokat, így kirajzolódnak az erősebb időszakok.',
    Icon: TrendingUp
  },
  {
    title: 'Időjárási bontás',
    body: 'Külön látszik az esős, szeles és csapadékmentes nyitvatartási napok átlagos látogatottsága.',
    Icon: CloudRain
  },
  {
    title: 'Több bejárat kezelése',
    body: 'A bejáratok adatai külön és összesítve is megjeleníthetők.',
    Icon: DoorOpen
  },
  {
    title: 'AI-alapú kamera',
    body: 'A kamera felismeri az áthaladás irányát, a rendszer pedig időponttal együtt rögzíti a be- vagy kilépést.',
    Icon: Camera
  }
]

/** AI kamera média-slot (GIF / MP4 kerül ide). */
export const BELEPOSZAMLALO_CAMERA = {
  eyebrow: 'Bejárat · élő kép',
  title: 'Így működik a számlálás',
  body: 'A bejáratnál elhelyezett kamera érzékeli az áthaladást és annak irányát. Az Optinovába a be- vagy kilépés időpontja kerül.',
  placeholder: 'Ide kerül a kamera működését bemutató felvétel',
  meta: 'Bejárat · 1280×720'
} as const

export const BELEPOSZAMLALO_TODAY = {
  title: 'Mai látogatottság óránként',
  body: 'A grafikon külön mutatja a be- és kilépéseket. A kettő különbségéből a rendszer megbecsüli, hányan lehetnek bent az üzletben.',
  caption: `A csütörtöki napi átlag ${
    WEEKDAY_PROFILE[3]?.avgIn ?? MONTH_AVG_IN
  } belépés.`
} as const

export const BELEPOSZAMLALO_DEMO = {
  title: 'Napi, heti és éves bontás',
  body: 'Válts a nézetek között, és nézd meg, hogyan változik a látogatottság naponta, a hét különböző napjain és az év során.',
  tabs: {
    month: {
      label: 'Hónap',
      caption: `Márciusban ${formatCount(MONTH_TOTAL_IN)} belépést mért a rendszer ${
        OPEN_DAYS.length
      } nyitvatartási napon. A napi átlag ${MONTH_AVG_IN} volt.${
        CAMPAIGN_DAY && CAMPAIGN_BASELINE_DAY
          ? ` Március ${CAMPAIGN_DAY.day}-én ${CAMPAIGN_DAY.inCount} belépést rögzített, egy héttel korábban ${CAMPAIGN_BASELINE_DAY.inCount}-et.`
          : ''
      }`
    },
    weekday: {
      label: 'Hét napja',
      caption: `Legmagasabb napi átlag márciusban: ${
        BUSIEST_WEEKDAY.label.toLocaleLowerCase('hu-HU')
      }, ${
        BUSIEST_WEEKDAY.avgIn
      } belépés. Szombaton átlagosan ${
        WEEKDAY_PROFILE[5]?.avgIn ?? 0
      } belépést mért a rendszer.`
    },
    season: {
      label: 'Szezon',
      caption: `A vizsgált 12 hónap legerősebb hónapjában ${formatCount(
        SEASON_BEST.totalIn
      )}, a leggyengébben ${formatCount(
        SEASON_WORST.totalIn
      )} belépést rögzített a rendszer.`
    }
  }
} as const

export const BELEPOSZAMLALO_HEATMAP = {
  eyebrow: 'Heti látogatottsági térkép',
  title: 'Melyik napon, melyik órában érkeznek a legtöbben?',
  body: 'A sorok a hét napjait, az oszlopok a nyitvatartási órákat mutatják. Minél sötétebb egy mező, annál több belépést mért a rendszer.',
  insights: [
    `A legnagyobb óránkénti látogatottság: ${HEATMAP_PEAK.label.toLocaleLowerCase('hu-HU')}, ${HEATMAP_PEAK.hour}:00–${HEATMAP_PEAK.hour + 1}:00. Ebben az órában ${HEATMAP_PEAK.value} belépést mért a rendszer.`,
    `A legmagasabb napi átlag: ${BUSIEST_WEEKDAY.label.toLocaleLowerCase('hu-HU')}, ${BUSIEST_WEEKDAY.avgIn} belépés.`,
    'Nyitás után minden hétköznap alacsonyabb volt a belépésszám. Ez az időszak alkalmasabb lehet készletezésre vagy háttérmunkára.'
  ]
} as const

export const BELEPOSZAMLALO_WEATHER = {
  title: 'Így alakult a látogatottság esős és szeles napokon',
  body: 'A rendszer az üzlet címéhez tartozó óránkénti időjárási adatokat a nyitvatartási időre szűri. Így az esős és szeles napok külön összehasonlíthatók a csapadékmentes napokkal.',
  insight:
    RAIN_BUCKET && DRY_BUCKET
      ? `A bemutatott hónapban az esős napokon átlagosan ${RAIN_BUCKET.avgIn}, a csapadékmentes napokon ${DRY_BUCKET.avgIn} belépést mért a rendszer. Az esős napok átlaga ${Math.round(
          ((DRY_BUCKET.avgIn - RAIN_BUCKET.avgIn) / DRY_BUCKET.avgIn) * 100
        )}%-kal volt alacsonyabb.`
      : '',
  note: 'Esős nap: 8 és 17 óra között legalább két egymást követő órában 0,5 mm vagy több csapadék. Szeles nap: a legnagyobb szélsebesség eléri a 25 km/h-t, vagy az átlagos szélsebesség a 18 km/h-t. Az óránkénti adatokat az Open-Meteo szolgáltatja az üzlet címéhez.'
} as const

export const BELEPOSZAMLALO_CONVERSION = {
  title: 'A belépésszám segít értelmezni az eladásokat',
  body: 'Ha csökken az árbevétel, a belépésszámból látszik, hogy kevesebben tértek-e be az üzletbe. Ha a látogatottság nem változott, az okot az ajánlatban, az árakban vagy a kiszolgálásban érdemes keresni.'
} as const

export type HowStep = {
  title: string
  body: string
}

export const BELEPOSZAMLALO_HOW: HowStep[] = [
  {
    title: 'Felkerül a kamera a bejárathoz',
    body: 'A telepítéshez áram és hálózati kapcsolat szükséges. A kamera pontos helyét a bejárat alapján egyeztetjük.'
  },
  {
    title: 'Külön rögzíti a be- és kilépéseket',
    body: 'Minden áthaladáshoz irány és időpont tartozik.'
  },
  {
    title: 'Az adatok megjelennek az Optinovában',
    body: 'A napi összesítés, az óránkénti bontás és a havi összehasonlítás ugyanabban a rendszerben érhető el.'
  }
]

export type AudienceCase = {
  title: string
  body: string
}

export const BELEPOSZAMLALO_AUDIENCE: AudienceCase[] = [
  {
    title: 'Nem tudod, mikor van csúcsidő',
    body: 'Látod a napi eladásokat, de azt nem, mikor érkezett a legtöbb látogató.'
  },
  {
    title: 'Látogatottság alapján készítenéd a beosztást',
    body: 'Az óránkénti belépésszám alapján könnyebb eldönteni, mikor legyen több kolléga az üzletben.'
  },
  {
    title: 'Több üzletet vagy bejáratot hasonlítanál össze',
    body: 'A bejáratok adatai külön és összesítve is megjelennek.'
  },
  {
    title: 'Forgókapu nélkül mérnéd a látogatottságot',
    body: 'A kamerás számláláshoz nem kell beléptetőkártya vagy forgókapu.'
  }
]

export const BELEPOSZAMLALO_STORE_NOTE: {
  title: string
  body: string
  Icon: LucideIcon
} = {
  title: 'Mit rögzít az Optinova?',
  body: 'A rendszer minden eseménynél az áthaladás irányát, időpontját és a számláló eszköz azonosítóját rögzíti.',
  Icon: Store
}

export const BELEPOSZAMLALO_CTA = {
  title: 'Nézd meg, mit mutatna a saját üzleted látogatottsága',
  body: 'Egy rövid bemutatón végigvesszük a napi és havi nézeteket, az időjárási bontást és a kamera telepítésének feltételeit.',
  reassurance: [
    '2 hónap ingyenes próba',
    '5 000 Ft + ÁFA havonta',
    'A kamera árára külön ajánlat'
  ]
} as const
