/**
 * Platformszintű jogi konstansok — a tenantnak nem kell megadnia.
 * Forrás és ellenőrzés dátuma: doc 41 §4. Jogszabály- vagy címváltozáskor itt kell frissíteni,
 * és a LEGAL_TEMPLATE_VERSION emelésével minden bolt új változatot kap.
 */

import type {
  CarrierCode,
  ConciliationBody,
  CountyCode,
  LegalCarrier,
  LegalDocKind,
  LegalParty,
  LegalProcessor,
  PaymentCode
} from '@/lib/webshop/legal/types'

export const LEGAL_TEMPLATE_VERSION = '2026-09-28'

export const LEGAL_BASE_PATH = '/info'

export function legalPath(kind: LegalDocKind): string {
  return `${LEGAL_BASE_PATH}/${kind}`
}

/** A 45/2014. Korm. r. 22. § (1b) szerinti kötelező felirat. */
export const WITHDRAWAL_LABEL = 'Elállás a szerződéstől'
export const WITHDRAWAL_CONFIRM_LABEL = 'Elállás megerősítése'
export const WITHDRAWAL_ANCHOR = 'urlap'

export const LEGAL_DOCS: Record<LegalDocKind, { title: string; short: string }> = {
  aszf: { title: 'Általános Szerződési Feltételek', short: 'ÁSZF' },
  adatkezeles: { title: 'Adatkezelési tájékoztató', short: 'Adatkezelés' },
  elallas: { title: 'Elállás a szerződéstől', short: 'Elállás' },
  'szallitas-es-fizetes': { title: 'Szállítás és fizetés', short: 'Szállítás és fizetés' },
  panaszkezeles: { title: 'Panaszkezelés és jogorvoslat', short: 'Panaszkezelés' },
  impresszum: { title: 'Impresszum', short: 'Impresszum' },
  sutik: { title: 'Sütik és helyi tárolás', short: 'Sütik' },
  akadalymentesseg: { title: 'Akadálymentességi nyilatkozat', short: 'Akadálymentesség' }
}

/** Ekertv. 4. § — minden bolt a platformon fut. */
export const HOSTING_PROVIDER: LegalParty = {
  name: 'Vercel Inc.',
  address: '440 N Barranca Ave #4133, Covina, CA 91723, Amerikai Egyesült Államok',
  email: 'privacy@vercel.com',
  website: 'https://vercel.com'
}

export const PLATFORM_OPERATOR: LegalParty = {
  name: 'HÍRÖS-ABLAK Kft. (Optinova)',
  address: '6000 Kecskemét, Mindszenti krt. 10.',
  email: 'info@turinova.hu',
  website: 'https://optinova.hu'
}

export const PLATFORM_PROCESSORS: LegalProcessor[] = [
  {
    name: PLATFORM_OPERATOR.name,
    task: 'a webáruház-szoftver üzemeltetése, adatok tárolása a Megrendelő nevében',
    address: PLATFORM_OPERATOR.address,
    website: PLATFORM_OPERATOR.website ?? null,
    thirdCountry: false
  },
  {
    name: HOSTING_PROVIDER.name,
    task: 'tárhely, weboldal kiszolgálása, szervernaplók',
    address: HOSTING_PROVIDER.address,
    website: HOSTING_PROVIDER.website ?? null,
    thirdCountry: true
  },
  {
    name: 'Supabase Inc.',
    task: 'adatbázis és fájltárolás',
    address: null,
    website: 'https://supabase.com',
    thirdCountry: true
  }
]

export const EMAIL_PROCESSOR: LegalProcessor = {
  name: 'Resend (Plus Five Five, Inc.)',
  task: 'rendszerüzenetek (visszaigazolások, elállási elismervény) e-mail kézbesítése',
  address: null,
  website: 'https://resend.com',
  thirdCountry: true
}

export const INVOICING_PROCESSOR: LegalProcessor = {
  name: 'KBOSS.hu Kft. (Számlázz.hu)',
  task: 'számla kiállítása és megőrzése',
  address: '1031 Budapest, Záhony utca 7.',
  website: 'https://www.szamlazz.hu',
  thirdCountry: false
}

export const CARD_PROCESSOR: LegalProcessor = {
  name: 'Stripe Payments Europe, Ltd.',
  task: 'bankkártyás és mobilfizetés (Apple Pay, Google Pay) lebonyolítása',
  address: '1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Írország',
  website: 'https://stripe.com',
  thirdCountry: false
}

export const CARRIERS: Record<CarrierCode, LegalCarrier> = {
  gls: {
    code: 'gls',
    label: 'GLS futárszolgálat',
    kind: 'home',
    company: {
      name: 'GLS General Logistics Systems Hungary Kft.',
      address: '2351 Alsónémedi, GLS Európa u. 2.',
      email: null,
      website: 'https://gls-group.com/HU/hu'
    }
  },
  mpl: {
    code: 'mpl',
    label: 'MPL (Magyar Posta)',
    kind: 'home',
    company: {
      name: 'Magyar Posta Zrt.',
      address: '1138 Budapest, Dunavirág utca 2-6.',
      email: null,
      website: 'https://www.posta.hu'
    }
  },
  dpd: {
    code: 'dpd',
    label: 'DPD futárszolgálat',
    kind: 'home',
    company: { name: 'DPD Hungária Kft.', address: null, email: null, website: 'https://www.dpd.com/hu/hu' }
  },
  express_one: {
    code: 'express_one',
    label: 'Express One futárszolgálat',
    kind: 'home',
    company: { name: 'Express One Hungary Kft.', address: null, email: null, website: 'https://expressone.hu' }
  },
  foxpost: {
    code: 'foxpost',
    label: 'Foxpost csomagautomata',
    kind: 'locker',
    company: { name: 'FoxPost Zrt.', address: null, email: null, website: 'https://foxpost.hu' }
  },
  packeta: {
    code: 'packeta',
    label: 'Packeta átvételi pont és automata',
    kind: 'point',
    company: { name: 'Packeta Hungary Kft.', address: null, email: null, website: 'https://www.packeta.hu' }
  },
  easybox: {
    code: 'easybox',
    label: 'Sameday easybox csomagautomata',
    kind: 'locker',
    company: { name: 'Sameday Hungary Kft.', address: null, email: null, website: 'https://sameday.hu' }
  },
  own: { code: 'own', label: 'Saját kiszállítás', kind: 'own', company: null }
}

export const CARRIER_CODES = Object.keys(CARRIERS) as [CarrierCode, ...CarrierCode[]]

export const PAYMENT_METHODS: Record<PaymentCode, { label: string; hint: string }> = {
  card: { label: 'Bankkártya, Apple Pay, Google Pay', hint: 'Online, a rendelés leadásakor' },
  transfer: { label: 'Banki átutalás', hint: 'Díjbekérő alapján, jóváírás után postázunk' },
  cod: { label: 'Utánvét', hint: 'A futárnak fizet átvételkor' },
  pickup_cash: { label: 'Készpénz személyes átvételkor', hint: 'Csak személyes átvételnél' },
  pickup_card: { label: 'Bankkártya személyes átvételkor', hint: 'Csak személyes átvételnél' }
}

export const PAYMENT_CODES = Object.keys(PAYMENT_METHODS) as [PaymentCode, ...PaymentCode[]]

export const DEFAULT_TRANSFER_HOLD_DAYS = 5

export const COUNTIES: Record<CountyCode, { label: string; court: string; prefix: string }> = {
  budapest: { label: 'Budapest', court: 'Fővárosi Törvényszék Cégbírósága', prefix: '01' },
  baranya: { label: 'Baranya', court: 'Pécsi Törvényszék Cégbírósága', prefix: '02' },
  bacs: { label: 'Bács-Kiskun', court: 'Kecskeméti Törvényszék Cégbírósága', prefix: '03' },
  bekes: { label: 'Békés', court: 'Gyulai Törvényszék Cégbírósága', prefix: '04' },
  baz: { label: 'Borsod-Abaúj-Zemplén', court: 'Miskolci Törvényszék Cégbírósága', prefix: '05' },
  csongrad: { label: 'Csongrád-Csanád', court: 'Szegedi Törvényszék Cégbírósága', prefix: '06' },
  fejer: { label: 'Fejér', court: 'Székesfehérvári Törvényszék Cégbírósága', prefix: '07' },
  gyms: { label: 'Győr-Moson-Sopron', court: 'Győri Törvényszék Cégbírósága', prefix: '08' },
  hajdu: { label: 'Hajdú-Bihar', court: 'Debreceni Törvényszék Cégbírósága', prefix: '09' },
  heves: { label: 'Heves', court: 'Egri Törvényszék Cégbírósága', prefix: '10' },
  komarom: { label: 'Komárom-Esztergom', court: 'Tatabányai Törvényszék Cégbírósága', prefix: '11' },
  nograd: { label: 'Nógrád', court: 'Balassagyarmati Törvényszék Cégbírósága', prefix: '12' },
  pest: { label: 'Pest', court: 'Budapest Környéki Törvényszék Cégbírósága', prefix: '13' },
  somogy: { label: 'Somogy', court: 'Kaposvári Törvényszék Cégbírósága', prefix: '14' },
  szabolcs: { label: 'Szabolcs-Szatmár-Bereg', court: 'Nyíregyházi Törvényszék Cégbírósága', prefix: '15' },
  jnsz: { label: 'Jász-Nagykun-Szolnok', court: 'Szolnoki Törvényszék Cégbírósága', prefix: '16' },
  tolna: { label: 'Tolna', court: 'Szekszárdi Törvényszék Cégbírósága', prefix: '17' },
  vas: { label: 'Vas', court: 'Szombathelyi Törvényszék Cégbírósága', prefix: '18' },
  veszprem: { label: 'Veszprém', court: 'Veszprémi Törvényszék Cégbírósága', prefix: '19' },
  zala: { label: 'Zala', court: 'Zalaegerszegi Törvényszék Cégbírósága', prefix: '20' }
}

export const COUNTY_CODES = Object.keys(COUNTIES) as [CountyCode, ...CountyCode[]]

/** 2024. január 1-jétől 8 békéltető testület (Budapest és Pest külön, a többi 3 vármegyére). */
export const CONCILIATION_BODIES: ConciliationBody[] = [
  {
    name: 'Budapesti Békéltető Testület',
    address: '1016 Budapest, Krisztina krt. 99.',
    phone: '+36 1 488 2131',
    email: 'bekelteto.testulet@bkik.hu',
    website: 'https://bekeltet.bkik.hu',
    counties: ['budapest']
  },
  {
    name: 'Pest Vármegyei Békéltető Testület',
    address: '1055 Budapest, Balassi Bálint u. 25. IV. em. 2.',
    phone: '+36 1 792 7881',
    email: 'pmbekelteto@pmkik.hu',
    website: 'https://panaszrendezes.hu',
    counties: ['pest']
  },
  {
    name: 'Baranya Vármegyei Békéltető Testület',
    address: '7625 Pécs, Majorossy I. u. 36.',
    phone: '+36 72 507 154',
    email: 'info@baranyabekeltetes.hu',
    website: 'https://baranyabekeltetes.hu',
    counties: ['baranya', 'somogy', 'tolna']
  },
  {
    name: 'Borsod-Abaúj-Zemplén Vármegyei Békéltető Testület',
    address: '3525 Miskolc, Szentpáli u. 1.',
    phone: '+36 46 501 090',
    email: 'bekeltetes@bokik.hu',
    website: 'https://bekeltetes.borsodmegye.hu',
    counties: ['baz', 'heves', 'nograd']
  },
  {
    name: 'Csongrád-Csanád Vármegyei Békéltető Testület',
    address: '6721 Szeged, Párizsi krt. 8-12.',
    phone: '+36 62 549 392',
    email: 'bekelteto.testulet@cskik.hu',
    website: 'https://bekeltetes-csongrad.hu',
    counties: ['bacs', 'bekes', 'csongrad']
  },
  {
    name: 'Fejér Vármegyei Békéltető Testület',
    address: '8000 Székesfehérvár, Hosszúsétatér 4-6.',
    phone: '+36 22 510 310',
    email: 'bekeltetes@fmkik.hu',
    website: 'https://bekeltetesfejer.hu',
    counties: ['fejer', 'komarom', 'veszprem']
  },
  {
    name: 'Győr-Moson-Sopron Vármegyei Békéltető Testület',
    address: '9022 Győr, Szent István út 10/A',
    phone: '+36 96 520 217',
    email: 'bekelteto.testulet@gymsmkik.hu',
    website: 'https://bekeltetesgyor.hu',
    counties: ['gyms', 'vas', 'zala']
  },
  {
    name: 'Hajdú-Bihar Vármegyei Békéltető Testület',
    address: '4025 Debrecen, Vörösmarty u. 13-15.',
    phone: '+36 52 500 710',
    email: 'bekelteto@hbkik.hu',
    website: 'https://hbmbekeltetes.hu',
    counties: ['hajdu', 'jnsz', 'szabolcs']
  }
]

export const CONCILIATION_LIST_URL = 'https://bekeltetes.hu'

export const NAIH: LegalParty = {
  name: 'Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)',
  address: '1055 Budapest, Falk Miksa utca 9-11. (postacím: 1363 Budapest, Pf. 9.)',
  email: 'ugyfelszolgalat@naih.hu',
  phone: '+36 1 391 1400',
  website: 'https://naih.hu'
}

export const CONSUMER_AUTHORITY_URL = 'https://kormanyhivatalok.hu'
