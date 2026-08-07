import Script from "next/script"
import { SzakagiLanding } from "@/components/site/szakagi/SzakagiLanding"
import { ORGANIZATION_ID } from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  pageMetadata,
} from "@/lib/seo"
import { SZAKAGI_FAQ, SZAKAGI_HERO, SZAKAGI_TRADES } from "@/lib/szakagi-landing"

export const metadata = pageMetadata({
  title: ROUTES.szakagi.title,
  description: ROUTES.szakagi.description,
  canonical: ROUTES.szakagi.path,
  ogImage: SZAKAGI_HERO.image,
})

function buildServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Szakági kivitelezés Bács-Kiskun és Pest megyében",
    description: SZAKAGI_HERO.lead,
    url: absoluteUrl(ROUTES.szakagi.path),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: ["Bács-Kiskun megye", "Pest megye", "Balaton környéke"],
    image: absoluteUrl(SZAKAGI_HERO.image),
  }
}

function buildTradesItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "BauGenerál szakági munkák",
    description:
      "Önálló szakági kivitelezés generálkivitelezés nélkül: villanyszerelés, gépészet, burkolás és további szakágak Bács-Kiskun és Pest megyében.",
    numberOfItems: SZAKAGI_TRADES.length,
    itemListElement: SZAKAGI_TRADES.map((trade, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: trade.seoTitle,
      description: trade.description,
      url: absoluteUrl(`${ROUTES.szakagi.path}#${trade.id}`),
    })),
  }
}

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SZAKAGI_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

export default function SzakagiKivitelezesPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Szakági kivitelezés", path: ROUTES.szakagi.path },
  ])

  return (
    <>
      <Script
        id="jsonld-breadcrumb-szakagi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-service-szakagi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildServiceJsonLd()) }}
      />
      <Script
        id="jsonld-itemlist-szakagi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildTradesItemListJsonLd()),
        }}
      />
      <Script
        id="jsonld-faq-szakagi"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
      <SzakagiLanding />
    </>
  )
}
