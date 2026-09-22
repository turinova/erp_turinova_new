import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Clock,
  FileWarning,
  Hammer,
  MessageSquare,
  PackageCheck,
  Phone,
  Printer,
  ScanLine,
  Store,
  UserPlus,
  Wrench
} from 'lucide-react'

/** Lapszabászati modul landing — shell copy, szekciónként finomítjuk. */

export const LAPSZABASZAT_HERO = {
  eyebrow: 'Iparági szinten egyedülálló',
  title: 'Lapszabászati gyártásmodul — a megrendeléstől az átvételig',
  body: 'A megrendelő saját fiókból, optimalizálva adja le az igényt; a műhely egy kattintással veszi át; a scan és az SMS zárja a kört. Nálunk a Hírös-Ablaknál 2025 márciusa óta ez fut élesben.',
  mediaLabel: 'Fő videó: 60–90 mp — partnerportál, Opti, gyártás, scan'
} as const

export type LapszabaszatPain = {
  title: string
  body: string
  Icon: LucideIcon
}

export const LAPSZABASZAT_PAINS: LapszabaszatPain[] = [
  {
    title: 'Az ajánlat 1–2 hét volt',
    body: 'A leterheltségtől függően ennyi kellett, amíg a műszaki előkészítő végigszámolta a megrendelést.',
    Icon: Clock
  },
  {
    title: 'Kézi átvitel, kézi hibák',
    body: 'A méretek e-mailből, papírról kerültek át — minden lépésnél egy újabb hibalehetőség.',
    Icon: FileWarning
  },
  {
    title: 'A vevő telefonált',
    body: '„Megvan már?” — a státuszt csak úgy tudta meg, ha felhívott valakit.',
    Icon: Phone
  }
]

export type LapszabaszatStep = {
  title: string
  body: string
  Icon: LucideIcon
  mediaLabel: string
}

export const LAPSZABASZAT_LOOP: LapszabaszatStep[] = [
  {
    title: 'Partner leadja a megrendelést',
    body: 'A megrendelő saját fiókban, optimalizálva állítja össze a lapszabászati megrendelést — a hét minden napján, 0–24, a ti áraitokkal. Azonnal árat kap, az anyag pontossága a vevő felelőssége.',
    Icon: UserPlus,
    mediaLabel: 'Videó/kép: partnerportál — Opti form kitöltése'
  },
  {
    title: 'Egy kattintás a gyártásba',
    body: 'A gyártás-előkészítő egyből átemeli a megrendelést táblafelosztó formátumba, és a megrendelés dátuma alapján ütemezi, mikor kerül gyártásba.',
    Icon: Wrench,
    mediaLabel: 'Kép: táblafelosztás / szabásjegyzék'
  },
  {
    title: 'Gyártás és státusz',
    body: 'A megrendelő követi, mikor került gyártásba a rendelése — nem kell telefonálnia.',
    Icon: Hammer,
    mediaLabel: 'Kép: műhely, gyártási lap'
  },
  {
    title: 'Scan → SMS',
    body: 'Amikor elkészült, a kollégánk lescanneli a gyártási lapon lévő vonalkódot, és a megrendelő automatikusan SMS-t kap az elkészülésről.',
    Icon: ScanLine,
    mediaLabel: 'Videó/kép: vonalkód scan + SMS a telefonon'
  },
  {
    title: 'Átvétel és két bizonylat',
    body: 'Áruátvételnél újabb scan: a megrendelés átvett státuszba kerül, és két bizonylat nyomtatódik — egy a vevőnek, egy az árukiadónak, aki pontosan tudja, mit kell átadnia. Így záródik a kör.',
    Icon: PackageCheck,
    mediaLabel: 'Kép: áruátadás, bizonylat nyomtatás'
  }
]

export type LapszabaszatFeature = {
  title: string
  body: string
  Icon: LucideIcon
}

export const LAPSZABASZAT_PORTAL: LapszabaszatFeature[] = [
  {
    title: 'Saját fiók a megrendelőknek',
    body: 'Regisztráció után a partner a saját megrendeléseit és ajánlatait látja.',
    Icon: Store
  },
  {
    title: 'Azonnali ár a ti áraitokkal',
    body: 'Nem nektek kell módosítani és visszaárazni — a partner egyből árat kap.',
    Icon: BadgeCheck
  },
  {
    title: 'Automatikus értesítés',
    body: 'SMS az elkészülésről, naplózott kiküldéssel.',
    Icon: MessageSquare
  },
  {
    title: 'Bizonylat és vonalkód',
    body: 'Gyártási lap vonalkóddal, átvételi bizonylat két példányban.',
    Icon: Printer
  }
]

export const LAPSZABASZAT_STATS = [
  { value: '5000+', label: 'Ajánlat a rendszerben', hint: 'Nem demóadat' },
  { value: '500+', label: 'Regisztrált megrendelő', hint: 'Saját fiókkal' },
  {
    value: '~10 perc',
    label: 'Ajánlatadás',
    hint: 'Korábban 1–2 hét'
  },
  {
    value: '~210 óra / hó',
    label: 'Becsült megtakarítás',
    hint: '~500 rendelés/hó · ~15+10 perc/rendelés'
  }
] as const

export const LAPSZABASZAT_AUDIENCE = [
  'Lapszabászattal dolgozó bútorgyártó',
  'Asztalos partnereket kiszolgáló anyagkereskedő',
  'Bútorlap- és élzáró forgalmazó',
  'Saját műhelyt és boltot is üzemeltető cég'
] as const
