/**
 * Single source of truth for Hírös-Ablak company data.
 * Used by JSON-LD (Organization, LocalBusiness), the contact page,
 * the footer, and the contact API.
 *
 * Brand spelling: the legal entity is "HÍRÖS-ABLAK Kft." (umlaut, hyphen).
 * "Hírös" is the dialectal/historical spelling — Kecskemét is a "hírös város".
 *
 * Keep this file in sync with the official cégadatok.
 */

export const COMPANY = {
  brand: "Hírös-Ablak",
  legalName:
    "HÍRÖS-ABLAK Kereskedelmi és Szolgáltató Korlátolt Felelősségű Társaság",
  shortName: "HÍRÖS-ABLAK Kft.",
  taxId: "11421386203",
  eutr: "AB4719440",
  companyRegistrationNumber: "03-09-104700",
  mainActivity: {
    code: "3100.25",
    name: "Bútorgyártás",
  },
  foundingDate: "1996-07-01",
  website: "https://www.hirosablak.hu",
  address: {
    country: "Magyarország",
    countryCode: "HU",
    postalCode: "6000",
    city: "Kecskemét",
    street: "Mindszenti krt. 10.",
    full: "6000 Kecskemét, Mindszenti krt. 10.",
  },
  // Confirmed via OpenStreetMap (POI: "Hírös-Ablak Faipari Áruház")
  geo: {
    latitude: 46.8910088,
    longitude: 19.6920785,
  },
  phones: {
    primary: "+3676481729",
    secondary: "+3676505705",
  },
  emails: {
    central: "hirosablak@hirosablak.hu",
    procurement: "aruhaz@hirosablak.hu",
    finance: "butor@hirosablak.hu",
  },
  hours: {
    weekdays: { opens: "08:00", closes: "17:00" },
    saturday: { opens: "08:00", closes: "12:00" },
    sundayClosed: true,
  },
  /** Megjelenítéshez (adószám 11 jegyű formátum). */
  taxIdDisplay: "11421386-2-03",
  /**
   * A www.hirosablak.hu weboldal technikai háttere (hivatalos tájékoztatókhoz).
   * Csak itt rögzített, ellenőrizhető tételek.
   */
  social: {
    facebook: "https://www.facebook.com/profile.php?id=100057176661141",
    instagram: "https://www.instagram.com/hirosablak/",
  },
  /** Kapcsolódó webáruház (külön márka, nem a Hírös-Ablak sameAs). */
  vasalatmester: {
    website: "https://www.vasalatmester.hu",
    facebook: "https://www.facebook.com/vasalatmester",
    instagram: "https://www.instagram.com/vasalatmester/",
  },
  webInfrastructure: {
    /** Next.js alkalmazás üzemeltetése */
    hostingProvider: "Vercel Inc.",
    hostingProviderUrl: "https://vercel.com",
    /** Bútorlap / munkalap katalógus adatbázisa (Supabase projekt) */
    databaseProvider: "Supabase, Inc.",
    databaseProviderUrl: "https://supabase.com",
    /** Domain regisztráció / DNS – ügyfél tájékoztatása szerint */
    domainProvider: "Rackhost Zrt.",
    domainProviderUrl: "https://www.rackhost.hu",
  },
} as const

/** NAIH – közhiteles elérhetőség (felügyeleti szerv). */
export const NAIH = {
  name: "Nemzeti Adatvédelmi és Információszabadság Hatóság",
  shortName: "NAIH",
  website: "https://naih.hu",
  address: "1055 Budapest, Falk Miksa utca 9-11.",
  phone: "+36 1 391 1400",
  email: "ugyfelszolgalat@naih.hu",
} as const

export function formatPhoneDisplay(e164ish: string): string {
  if (e164ish.startsWith("+36")) {
    const digits = e164ish.replace(/\s+/g, "")
    const m = digits.match(/^\+36(\d{2})(\d{3})(\d{3})$/)
    if (m) return `+36 ${m[1]} ${m[2]} ${m[3]}`
  }
  return e164ish
}

export function formatLatLngDisplay(lat: number, lng: number): string {
  // Hungarian decimal style: comma as decimal separator
  const fmt = (n: number) =>
    new Intl.NumberFormat("hu-HU", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(n)
  const ns = lat >= 0 ? "N" : "S"
  const ew = lng >= 0 ? "K" : "Ny"
  return `${fmt(Math.abs(lat))}° ${ns} • ${fmt(Math.abs(lng))}° ${ew}`
}

export function googleMapsDirectionsUrl(): string {
  const dest = encodeURIComponent(COMPANY.address.full)
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

export function googleMapsSearchUrl(): string {
  const { latitude, longitude } = COMPANY.geo
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

export function googleMapsEmbedUrl(): string {
  const q = encodeURIComponent(COMPANY.address.full)
  return `https://www.google.com/maps?q=${q}&output=embed`
}

export function wazeUrl(): string {
  const { latitude, longitude } = COMPANY.geo
  return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
}

export function appleMapsUrl(): string {
  const { latitude, longitude } = COMPANY.geo
  const q = encodeURIComponent(COMPANY.brand)
  return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`
}

export function buildOrganizationJsonLd() {
  const orgId = `${COMPANY.website}/#organization`
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: COMPANY.brand,
    legalName: COMPANY.legalName,
    alternateName: COMPANY.shortName,
    url: COMPANY.website,
    image: `${COMPANY.website}/img/kapcsolat_hero.jpg`,
    logo: `${COMPANY.website}/img/hiros_logo.png`,
    sameAs: [
      COMPANY.social.facebook,
      COMPANY.social.instagram,
      googleMapsSearchUrl(),
    ],
    foundingDate: COMPANY.foundingDate,
    taxID: COMPANY.taxId,
    vatID: COMPANY.taxId,
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "HU-cégjegyzékszám",
        value: COMPANY.companyRegistrationNumber,
      },
      {
        "@type": "PropertyValue",
        propertyID: "TEÁOR",
        value: `${COMPANY.mainActivity.code} ${COMPANY.mainActivity.name}`,
      },
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.address.street,
      postalCode: COMPANY.address.postalCode,
      addressLocality: COMPANY.address.city,
      addressCountry: COMPANY.address.countryCode,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: formatPhoneDisplay(COMPANY.phones.primary),
        email: COMPANY.emails.central,
        areaServed: "HU",
        availableLanguage: ["hu"],
      },
    ],
  }
}

export function buildLocalBusinessJsonLd() {
  const orgId = `${COMPANY.website}/#organization`
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${COMPANY.website}/#localbusiness`,
    name: COMPANY.brand,
    legalName: COMPANY.legalName,
    alternateName: COMPANY.shortName,
    url: COMPANY.website,
    image: `${COMPANY.website}/img/bemutato_hero.jpg`,
    logo: `${COMPANY.website}/img/hiros_logo.png`,
    parentOrganization: { "@id": orgId },
    sameAs: [
      COMPANY.social.facebook,
      COMPANY.social.instagram,
      googleMapsSearchUrl(),
    ],
    foundingDate: COMPANY.foundingDate,
    taxID: COMPANY.taxId,
    vatID: COMPANY.taxId,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.address.street,
      postalCode: COMPANY.address.postalCode,
      addressLocality: COMPANY.address.city,
      addressCountry: COMPANY.address.countryCode,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: COMPANY.geo.latitude,
      longitude: COMPANY.geo.longitude,
    },
    telephone: [
      formatPhoneDisplay(COMPANY.phones.primary),
      formatPhoneDisplay(COMPANY.phones.secondary),
    ],
    email: COMPANY.emails.central,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: COMPANY.hours.weekdays.opens,
        closes: COMPANY.hours.weekdays.closes,
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: COMPANY.hours.saturday.opens,
        closes: COMPANY.hours.saturday.closes,
      },
    ],
  }
}
