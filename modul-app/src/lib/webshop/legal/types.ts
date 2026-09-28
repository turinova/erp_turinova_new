/** Generált jogi oldalak — bemenet (LegalContext) és kimenet (LegalDoc). Doc 41. */

export const LEGAL_DOC_KINDS = [
  'aszf',
  'adatkezeles',
  'elallas',
  'szallitas-es-fizetes',
  'panaszkezeles',
  'impresszum',
  'sutik',
  'akadalymentesseg'
] as const

export type LegalDocKind = (typeof LEGAL_DOC_KINDS)[number]

export function isLegalDocKind(v: string): v is LegalDocKind {
  return (LEGAL_DOC_KINDS as readonly string[]).includes(v)
}

export type CarrierCode =
  | 'gls'
  | 'mpl'
  | 'dpd'
  | 'express_one'
  | 'foxpost'
  | 'packeta'
  | 'easybox'
  | 'own'

export type PaymentCode = 'card' | 'transfer' | 'cod' | 'pickup_cash' | 'pickup_card'

export type CountyCode =
  | 'budapest'
  | 'baranya'
  | 'bacs'
  | 'bekes'
  | 'baz'
  | 'csongrad'
  | 'fejer'
  | 'gyms'
  | 'hajdu'
  | 'heves'
  | 'jnsz'
  | 'komarom'
  | 'nograd'
  | 'pest'
  | 'somogy'
  | 'szabolcs'
  | 'tolna'
  | 'vas'
  | 'veszprem'
  | 'zala'

export type CompanyForm = 'kft' | 'bt' | 'kkt' | 'zrt' | 'nyrt' | 'ev' | 'other'

/** Webshop modul saját jogi bemenetei (tenant_webshop_settings). */
export type WebshopLegalSettings = {
  shippingCarriers: CarrierCode[]
  paymentMethods: PaymentCode[]
  bankAccount: string | null
  transferHoldDays: number | null
  returnShippingPaidBy: 'customer' | 'seller'
  sellerName: string | null
  postalCode: string | null
  city: string | null
  address: string | null
  email: string | null
  phone: string | null
  taxNumber: string | null
  registrationNumber: string | null
  vatId: string | null
  county: CountyCode | null
  serviceAddress: string | null
  supportHours: string | null
  audience: 'consumer' | 'business'
  madeToOrder: boolean
  mandatoryWarranty: boolean
  newsletter: boolean
  microEnterprise: boolean
  termsUrl: string | null
  privacyUrl: string | null
}

export type LegalParty = {
  name: string
  address: string | null
  email: string | null
  phone?: string | null
  website?: string | null
}

export type ConciliationBody = LegalParty & {
  counties: CountyCode[]
}

export type LegalCarrier = {
  code: CarrierCode
  label: string
  kind: 'home' | 'locker' | 'point' | 'own'
  company: LegalParty | null
}

export type LegalContext = {
  shopName: string
  shopUrl: string
  seller: {
    name: string
    form: CompanyForm
    postalCode: string | null
    city: string | null
    street: string | null
    /** Irányítószám + város + utca egy sorban. */
    address: string | null
    email: string | null
    phone: string | null
    website: string | null
    taxNumber: string | null
    vatId: string | null
    registrationNumber: string | null
    registrationLabel: 'Cégjegyzékszám' | 'Nyilvántartási szám'
    registryCourt: string | null
    county: CountyCode | null
  }
  hosting: LegalParty
  audience: 'consumer' | 'business'
  shipping: {
    carriers: LegalCarrier[]
    feeGross: number | null
    freeFromGross: number | null
    daysMin: number | null
    daysMax: number | null
    pickup: { enabled: boolean; label: string | null }
  }
  payments: PaymentCode[]
  bankAccount: string | null
  transferHoldDays: number
  returns: {
    days: number
    paidBy: 'customer' | 'seller'
    address: string | null
  }
  warranty: { voluntaryMonths: number | null; mandatory: boolean }
  madeToOrder: boolean
  serviceAddress: string | null
  supportHours: string | null
  conciliation: ConciliationBody | null
  processors: LegalProcessor[]
  features: {
    reviews: boolean
    stockNotify: boolean
    newsletter: boolean
    invoicing: boolean
    email: boolean
  }
  microEnterprise: boolean
}

export type LegalProcessor = {
  name: string
  task: string
  address: string | null
  website: string | null
  /** EU-n kívüli (USA) adattovábbítás. */
  thirdCountry: boolean
}

export type LegalNode =
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'dl'; rows: [string, string][] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'note'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'form'; id: 'withdrawal' }

export type LegalSection = {
  id: string
  title: string
  nodes: LegalNode[]
}

export type LegalDoc = {
  kind: LegalDocKind
  title: string
  /** Rövid, ikonos összefoglaló a dokumentum tetején. */
  summary: { label: string; value: string }[]
  intro: string[]
  sections: LegalSection[]
}

export type LegalMissing = {
  field: string
  label: string
  /** Hol javítható az adminban. */
  href: string
}
