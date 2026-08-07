import Script from "next/script"
import { AsztalosLanding } from "@/components/site/asztalos/AsztalosLanding"
import { ASZTALOS_FAQ, ASZTALOS_HERO } from "@/lib/asztalos-landing"
import { ORGANIZATION_ID } from "@/lib/company"
import { HIROS_ABLAK } from "@/lib/links"
import { ROUTES } from "@/lib/routes"
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  pageMetadata,
} from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Asztalos munkák",
  description: ROUTES.asztalos.description,
  canonical: ROUTES.asztalos.path,
  ogImage: ASZTALOS_HERO.image,
})

function buildHirosPartnerJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": HIROS_ABLAK.organizationId,
    name: HIROS_ABLAK.brand,
    legalName: HIROS_ABLAK.legalName,
    url: HIROS_ABLAK.website,
    description:
      "Kecskeméti faipari gyártó 1996 óta: kb. 1500 m² saját üzem, 500 m² bemutatóterem, lapszabászat, élzárás és egyedi bútor. A BauGenerál asztalos munkáinak gyártó partnere.",
    foundingDate: "1996-07-01",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Mindszenti krt. 10.",
      postalCode: "6000",
      addressLocality: "Kecskemét",
      addressCountry: "HU",
    },
    relatedTo: { "@id": ORGANIZATION_ID },
  }
}

function buildServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Asztalos munkák: egyedi bútor",
    description: ASZTALOS_HERO.lead,
    url: absoluteUrl(ROUTES.asztalos.path),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: ["Bács-Kiskun megye", "Pest megye", "Balaton környéke"],
    image: absoluteUrl(ASZTALOS_HERO.image),
  }
}

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ASZTALOS_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

export default function AsztalosMunkakPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Asztalos munkák", path: ROUTES.asztalos.path },
  ])

  return (
    <>
      <Script
        id="jsonld-breadcrumb-asztalos"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-service-asztalos"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildServiceJsonLd()) }}
      />
      <Script
        id="jsonld-faq-asztalos"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
      <Script
        id="jsonld-hiros-partner"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildHirosPartnerJsonLd()),
        }}
      />
      <AsztalosLanding />
    </>
  )
}
