/**
 * Szolgáltató (HÍRÖS-ABLAK Kft. / Turinova) + ProGate termék.
 * Jogi oldalak, impresszum, UI brand forrása.
 */

export const COMPANY = {
  /** Ügyfélnek látszó termékmárka */
  brand: "ProGate",
  /** Anyacég / cégmárka (jogi szövegben is) */
  parentBrand: "Turinova",
  /** Rövid termék-leírás */
  brandTagline: "B2B gyors rendelés Shoprenterhez",
  legalName:
    "HÍRÖS-ABLAK Kereskedelmi és Szolgáltató Korlátolt Felelősségű Társaság",
  shortName: "HÍRÖS-ABLAK Kft.",
  taxIdDisplay: "11421386-2-03",
  companyRegistrationNumber: "03-09-104700",
  /** Termék app */
  productUrl: "https://app.progate.hu",
  productHost: "app.progate.hu",
  /** Marketing / termék web (ha él) */
  marketingUrl: "https://progate.hu",
  marketingHost: "progate.hu",
  /** Anyacég web / impresszum */
  website: "https://www.turinova.hu",
  websiteHost: "www.turinova.hu",
  address: {
    full: "6000 Kecskemét, Mindszenti krt. 10.",
  },
  phones: {
    primaryDisplay: "+36 30 999 2800",
  },
  contactPerson: "Mező Dávid",
  emails: {
    /** Jogi / céges / termék support */
    central: "info@turinova.hu",
    /** Termék support (ugyanaz, mint central) */
    support: "info@turinova.hu",
  },
  webInfrastructure: {
    hostingProvider: "Vercel Inc.",
    hostingProviderUrl: "https://vercel.com",
    databaseProvider: "Supabase, Inc.",
    databaseProviderUrl: "https://supabase.com",
  },
} as const;

export const NAIH = {
  name: "Nemzeti Adatvédelmi és Információszabadság Hatóság",
  address: "1125 Budapest, Szilágyi Erzsébet fasor 22/C.",
  phone: "+36 (1) 391-1400",
  email: "ugyfelszolgalat@naih.hu",
  website: "https://naih.hu",
} as const;

export const LEGAL_LINKS = [
  { href: "/aszf", label: "ÁSZF" },
  { href: "/adatkezeles", label: "Adatkezelés" },
  { href: "/adatvedelem", label: "Adatvédelem" },
  { href: "/adatvedelmi-nyilatkozat", label: "Adatvédelmi nyilatkozat" },
] as const;
