/**
 * Single source of truth for BauGenerál Kft. company data.
 * Used by JSON-LD, footer, contact impressum, and llms.txt.
 */

export const COMPANY = {
  brand: "BauGenerál",
  legalName:
    "BauGenerál Építő és Szolgáltató Korlátolt Felelősségű Társaság",
  shortName: "BauGenerál Kft.",
  foundingDate: "2010-02-22",
  website: "https://www.baugeneral.hu",
  taxId: "12448023203",
  companyRegistrationNumber: "03-09-119766",
  mainActivity: {
    code: "4100.25",
    name: "Lakó- és nem lakóépület építése",
  },
  registeredCapitalHuf: 3_000_000,
  headcount: 8,
  headcountAsOf: "2026-06-08",
  entityDefinitionHu:
    "A BauGenerál Kft. 2010 óta működő generálkivitelező. Ipari épületek, családi házak, középületek, felújítások, szakági munkák és asztalos munkák Bács-Kiskunban, Pest megyében és Budapesten.",
  entityDefinitionEn:
    "BauGenerál Kft. is a general contractor based in Kecskemét, Hungary. Industrial buildings, family homes, public buildings, renovations, trade works and custom carpentry in Bács-Kiskun, Pest county and Budapest since 2010.",
  knowsAbout: [
    "generálkivitelezés",
    "ipari épületek",
    "családi ház építés",
    "középületek",
    "felújítás",
    "szakági kivitelezés",
    "asztalos munkák",
    "egyedi bútor",
  ] as const,
  serviceCities: [
    "Kecskemét",
    "Budapest",
    "Üröm",
    "Solymár",
    "Pilisvörösvár",
    "Pilisborosjenő",
    "Budakalász",
    "Nagykovácsi",
    "Telki",
    "Budajenő",
  ] as const,
  address: {
    country: "Magyarország",
    countryCode: "HU",
    postalCode: "6000",
    city: "Kecskemét",
    street: "Mindszenti krt. 10.",
    full: "6000 Kecskemét, Mindszenti krt. 10.",
  },
  geo: {
    latitude: 46.8910088,
    longitude: 19.6920785,
  },
  phones: {
    primary: "+36309586331",
  },
  emails: {
    central: "mezo.robert@baugeneral.hu",
  },
  serviceArea: [
    "Bács-Kiskun megye",
    "Pest megye",
    "Budapest",
    "Balaton környéke",
  ],
  social: {
    facebook: "https://www.facebook.com/Baugeneral",
    instagram: "https://www.instagram.com/baugeneral/",
  } as Partial<{
    facebook: string
    instagram: string
    linkedin: string
    googleBusiness: string
  }>,
  /** Not published — no public office hours. */
  openingHours: [] as readonly {
    dayOfWeek: readonly string[]
    opens: string
    closes: string
  }[],
} as const

export const PLACEHOLDER_PHONE = "+36700000000"

export function isPublicPhone(phone: string): boolean {
  const normalized = phone.replace(/\s+/g, "")
  return normalized !== PLACEHOLDER_PHONE && normalized.length > 0
}

export function formatTaxIdDisplay(taxId: string): string {
  const d = taxId.replace(/\D/g, "")
  if (d.length === 11) {
    return `${d.slice(0, 8)}-${d.slice(8, 9)}-${d.slice(9, 11)}`
  }
  return taxId
}

export function formatPhoneDisplay(e164ish: string): string {
  if (e164ish.startsWith("+36")) {
    const digits = e164ish.replace(/\s+/g, "")
    const m =
      digits.match(/^\+36(\d{2})(\d{3})(\d{4})$/) ??
      digits.match(/^\+36(\d{2})(\d{3})(\d{3})$/)
    if (m) {
      return m.length === 5
        ? `+36 ${m[1]} ${m[2]} ${m[3]}`
        : `+36 ${m[1]} ${m[2]} ${m[3]}`
    }
  }
  return e164ish
}

export function formatFoundingDateHu(): string {
  return new Date(COMPANY.foundingDate).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function googleMapsDirectionsUrl(): string {
  const dest = encodeURIComponent(COMPANY.address.full)
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

export function googleMapsEmbedUrl(): string {
  const q = encodeURIComponent(COMPANY.address.full)
  return `https://www.google.com/maps?q=${q}&output=embed`
}

export function googleMapsSearchUrl(): string {
  const q = encodeURIComponent(COMPANY.address.full)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export function formatLatLngDisplay(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`
}

export const ORGANIZATION_ID = `${COMPANY.website}/#organization`
export const LOCAL_BUSINESS_ID = `${COMPANY.website}/#localbusiness`
export const WEBSITE_ID = `${COMPANY.website}/#website`

export function buildOrganizationJsonLd() {
  const sameAs = [
    COMPANY.social.facebook,
    COMPANY.social.instagram,
    COMPANY.social.linkedin,
    COMPANY.social.googleBusiness,
  ].filter(Boolean)

  const contactPoint: Record<string, unknown> = {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: COMPANY.emails.central,
    areaServed: "HU",
    availableLanguage: ["hu", "en"],
  }
  if (isPublicPhone(COMPANY.phones.primary)) {
    contactPoint.telephone = formatPhoneDisplay(COMPANY.phones.primary)
  }

  const sameAsFull = [...sameAs, googleMapsSearchUrl()]

  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "GeneralContractor"],
    "@id": ORGANIZATION_ID,
    name: COMPANY.brand,
    legalName: COMPANY.legalName,
    alternateName: COMPANY.shortName,
    description: COMPANY.entityDefinitionHu,
    url: COMPANY.website,
    logo: `${COMPANY.website}/img/logo.svg`,
    image: `${COMPANY.website}/img/kapcsolat/telephely.png`,
    foundingDate: COMPANY.foundingDate,
    taxID: formatTaxIdDisplay(COMPANY.taxId),
    sameAs: sameAsFull,
    knowsAbout: [...COMPANY.knowsAbout],
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
    contactPoint: [contactPoint],
  }
}

export function buildLocalBusinessJsonLd(opts?: { pageUrl?: string }) {
  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    "@id": LOCAL_BUSINESS_ID,
    name: COMPANY.brand,
    legalName: COMPANY.legalName,
    url: opts?.pageUrl ?? COMPANY.website,
    description: COMPANY.entityDefinitionHu,
    parentOrganization: { "@id": ORGANIZATION_ID },
    taxID: formatTaxIdDisplay(COMPANY.taxId),
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
    email: COMPANY.emails.central,
    image: `${COMPANY.website}/img/kapcsolat/telephely.png`,
    areaServed: [
      ...COMPANY.serviceArea.map((name) => ({
        "@type": "AdministrativeArea",
        name,
      })),
      ...COMPANY.serviceCities.map((name) => ({
        "@type": "City",
        name,
      })),
    ],
    knowsAbout: [...COMPANY.knowsAbout],
  }
  if (isPublicPhone(COMPANY.phones.primary)) {
    json.telephone = formatPhoneDisplay(COMPANY.phones.primary)
  }
  if (COMPANY.openingHours.length > 0) {
    json.openingHoursSpecification = COMPANY.openingHours.map((slot) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [...slot.dayOfWeek],
      opens: slot.opens,
      closes: slot.closes,
    }))
  }
  return json
}

export type ImpressumRow = { label: string; value: string }

export function getImpressumRows(): ImpressumRow[] {
  const rows: ImpressumRow[] = [
    { label: "Cégnév", value: COMPANY.legalName },
    { label: "Székhely", value: COMPANY.address.full },
    { label: "Adószám", value: formatTaxIdDisplay(COMPANY.taxId) },
    { label: "Cégjegyzékszám", value: COMPANY.companyRegistrationNumber },
    { label: "E-mail", value: COMPANY.emails.central },
  ]
  if (isPublicPhone(COMPANY.phones.primary)) {
    rows.push({
      label: "Telefon",
      value: formatPhoneDisplay(COMPANY.phones.primary),
    })
  }
  rows.push({
    label: "Honlap",
    value: COMPANY.website.replace(/^https?:\/\//, ""),
  })
  return rows
}
