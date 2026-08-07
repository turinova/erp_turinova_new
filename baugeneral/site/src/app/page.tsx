import Script from "next/script"
import { HomeBelowFold } from "@/components/site/home/HomeBelowFold"
import { HomeHero } from "@/components/site/home/HomeHero"
import { HOME_FAQ, HOME_SERVICES } from "@/lib/home-landing"
import { ROUTES } from "@/lib/routes"
import { absoluteUrl, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.home.title,
  description: ROUTES.home.description,
  canonical: "/",
})

function buildHomeFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

function buildHomeServiceListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "BauGenerál szolgáltatások",
    itemListElement: HOME_SERVICES.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      url: absoluteUrl(item.href),
      description: item.text,
    })),
  }
}

export default function HomePage() {
  const faqJsonLd = buildHomeFaqJsonLd()
  const serviceListJsonLd = buildHomeServiceListJsonLd()

  return (
    <div className="bg-white">
      <Script
        id="jsonld-faq-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="jsonld-services-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceListJsonLd) }}
      />

      <HomeHero />
      <HomeBelowFold />
    </div>
  )
}
