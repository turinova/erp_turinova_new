/**
 * Strukturált adat az egyedi bútor oldalakhoz (hub + aloldalak).
 *
 * Egy helyen, mert a hub és a három aloldal ugyanazt a szolgáltatót, ugyanazt
 * a szolgáltatási területet és ugyanazt a folyamatot írja le — csak a
 * szolgáltatás neve és a hozzá tartozó GYIK más.
 */

import { COMPANY, formatPhoneDisplay } from "@/lib/company"
import { LOCAL_BUSINESS_ID, absoluteUrl } from "@/lib/seo"
import {
  CANONICAL_PATH,
  SPOKE_PAGES,
  SURVEY_AREAS,
  SURVEY_PHONE,
  SURVEY_STEPS,
  type FaqEntry,
} from "@/lib/egyedi-butor-data"

/** A Service.areaServed a megyékre és a főbb településekre épül. */
function areaServed() {
  const counties = [
    { "@type": "AdministrativeArea", name: "Pest megye" },
    { "@type": "AdministrativeArea", name: "Bács-Kiskun megye" },
  ]
  const regions = [{ "@type": "Place", name: "Balaton és környéke" }]
  const towns = SURVEY_AREAS.flatMap((area) =>
    area.places
      .filter((place) => !place.includes("kerület"))
      .map((name) => ({ "@type": "City", name })),
  )
  return [
    { "@type": "City", name: "Budapest" },
    ...counties,
    ...regions,
    ...towns,
  ]
}

export function buildFurnitureServiceJsonLd(input: {
  name: string
  description: string
  path: string
  serviceType: readonly string[]
  /** Ha megadja, a szolgáltatás alá kerül a három bútortípus kínálatként. */
  withOfferCatalog?: boolean
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(input.path)}#service`,
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    serviceType: [...input.serviceType],
    category: "Egyedi bútorgyártás",
    provider: {
      "@id": LOCAL_BUSINESS_ID,
      "@type": "LocalBusiness",
      name: COMPANY.brand,
      url: COMPANY.website,
      telephone: formatPhoneDisplay(COMPANY.phones.primary),
      address: {
        "@type": "PostalAddress",
        streetAddress: COMPANY.address.street,
        postalCode: COMPANY.address.postalCode,
        addressLocality: COMPANY.address.city,
        addressCountry: COMPANY.address.countryCode,
      },
    },
    areaServed: areaServed(),
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `${absoluteUrl(input.path)}#felmeres`,
      servicePhone: {
        "@type": "ContactPoint",
        telephone: formatPhoneDisplay(SURVEY_PHONE),
        contactType: "sales",
        availableLanguage: ["hu"],
      },
    },
    offers: {
      "@type": "Offer",
      name: "Helyszíni felmérés",
      price: "0",
      priceCurrency: "HUF",
      description: "Díjmentes helyszíni felmérés, kötelezettség nélkül",
    },
    ...(input.withOfferCatalog
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Egyedi bútor típusok",
            itemListElement: SPOKE_PAGES.map((spoke) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: spoke.navLabel,
                url: absoluteUrl(spoke.path),
              },
            })),
          },
        }
      : {}),
  }
}

export function buildFurnitureFaqJsonLd(items: readonly FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

export function buildSurveyHowToJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Így készül egy egyedi bútor a felméréstől a beépítésig",
    description:
      "A Hírös-Ablak egyedi bútor folyamata: díjmentes helyszíni felmérés, inspirációs képek és látványterv, tételes ajánlat, gyártás a kecskeméti üzemben, majd beépítés a saját csapatunkkal.",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "HUF",
      value: "0",
      name: "A helyszíni felmérés díjmentes",
    },
    step: SURVEY_STEPS.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.text,
      url: `${absoluteUrl(CANONICAL_PATH)}#folyamat`,
    })),
  }
}
