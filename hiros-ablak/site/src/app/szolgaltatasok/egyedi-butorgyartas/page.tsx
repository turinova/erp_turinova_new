import type { Metadata } from "next"
import {
  DEFAULT_OG_IMAGE_PATH,
  buildBreadcrumbJsonLd,
  pageMetadata,
} from "@/lib/seo"
import { COMPANY, buildLocalBusinessJsonLd } from "@/lib/company"
import PortfolioLanding from "@/components/egyedi-butor/PortfolioLanding"
import HubContent from "@/components/egyedi-butor/HubContent"
import {
  CANONICAL_PATH,
  FURNITURE_TYPES,
  HERO_IMAGES,
  HUB_FAQ,
  SURVEY_PHONE,
  SURVEY_PHONE_DISPLAY,
} from "@/lib/egyedi-butor-data"
import {
  buildFurnitureFaqJsonLd,
  buildFurnitureServiceJsonLd,
  buildSurveyHowToJsonLd,
} from "@/lib/egyedi-butor-seo"

export const metadata: Metadata = pageMetadata({
  title: "Egyedi bútorgyártás – konyha, gardrób, fürdőszoba",
  description:
    "Egyedi konyha 2 millió Ft-tól, beépített gardrób és fürdőszoba bútor. Díjmentes helyszíni felmérés Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén. Gyártás saját kecskeméti üzemünkben 1996 óta.",
  canonical: CANONICAL_PATH,
  ogImage: HERO_IMAGES[0]?.src ?? DEFAULT_OG_IMAGE_PATH,
})

const VALID_TYPES = new Set(FURNITURE_TYPES.map((t) => t.id))

type PageProps = {
  searchParams?: Promise<{ tipus?: string }>
}

export default async function EgyediButorgyartasPage({
  searchParams,
}: PageProps) {
  const sp = searchParams ? await searchParams : {}
  const defaultType =
    sp.tipus &&
    VALID_TYPES.has(sp.tipus as (typeof FURNITURE_TYPES)[number]["id"])
      ? sp.tipus
      : ""

  const localBusinessJsonLd = buildLocalBusinessJsonLd()

  const serviceJsonLd = buildFurnitureServiceJsonLd({
    name: "Egyedi bútorgyártás Budapesten, helyszíni felméréssel",
    description:
      "Egyedi konyha, beépített gardrób, fürdőszoba bútor és más méretre gyártott bútor Budapesten, Pest megyében, Bács-Kiskun megyében és a Balaton környékén. A helyszíni felmérés díjmentes, a gyártás a kecskeméti üzemünkben történik.",
    path: CANONICAL_PATH,
    serviceType: [
      "Egyedi bútorgyártás",
      "Egyedi konyhabútor",
      "Beépített gardrób",
      "Fürdőszoba bútor",
      "Helyszíni bútorfelmérés",
    ],
    withOfferCatalog: true,
  })

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Szolgáltatások", path: "/szolgaltatasok/lapszabaszat-es-elzaras" },
    { name: "Egyedi bútorgyártás", path: CANONICAL_PATH },
  ])

  return (
    <>
      <script
        id="ld-localbusiness-egyedi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd),
        }}
      />
      <script
        id="ld-service-egyedi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        id="ld-breadcrumb-egyedi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        id="ld-howto-egyedi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSurveyHowToJsonLd()),
        }}
      />
      <script
        id="ld-faq-egyedi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFurnitureFaqJsonLd(HUB_FAQ)),
        }}
      />

      <PortfolioLanding
        defaultType={defaultType}
        email={COMPANY.emails.central}
      />

      <HubContent
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={`tel:${SURVEY_PHONE}`}
      />
    </>
  )
}
