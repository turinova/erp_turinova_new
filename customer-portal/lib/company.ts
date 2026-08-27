/**
 * Szolgáltató cégadatok (HÍRÖS-ABLAK Kft.) + Turinova termék.
 * Jogi oldalak forrása.
 */

export const COMPANY = {
  brand: 'Turinova',
  legalName:
    'HÍRÖS-ABLAK Kereskedelmi és Szolgáltató Korlátolt Felelősségű Társaság',
  shortName: 'HÍRÖS-ABLAK Kft.',
  taxIdDisplay: '11421386-2-03',
  companyRegistrationNumber: '03-09-104700',
  website: 'https://www.turinova.hu',
  websiteHost: 'www.turinova.hu',
  address: {
    full: '6000 Kecskemét, Mindszenti krt. 10.',
  },
  phones: {
    primaryDisplay: '+36 30 999 2800',
  },
  contactPerson: 'Mező Dávid',
  emails: {
    central: 'info@turinova.hu',
  },
  webInfrastructure: {
    hostingProvider: 'Vercel Inc.',
    hostingProviderUrl: 'https://vercel.com',
    databaseProvider: 'Supabase, Inc.',
    databaseProviderUrl: 'https://supabase.com',
  },
} as const

export const NAIH = {
  name: 'Nemzeti Adatvédelmi és Információszabadság Hatóság',
  address: '1125 Budapest, Szilágyi Erzsébet fasor 22/C.',
  phone: '+36 (1) 391-1400',
  email: 'ugyfelszolgalat@naih.hu',
  website: 'https://naih.hu',
} as const

export const LEGAL_LINKS = [
  { href: '/aszf', label: 'ÁSZF' },
  { href: '/adatkezeles', label: 'Adatkezelés' },
  { href: '/adatvedelem', label: 'Adatvédelem' },
  { href: '/adatvedelmi-nyilatkozat', label: 'Adatvédelmi nyilatkozat' },
  { href: '/sutik', label: 'Sütik' },
] as const
