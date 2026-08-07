import Script from "next/script"
import { ContactFaqSection } from "@/components/site/contact/ContactFaqSection"
import { ContactHero } from "@/components/site/contact/ContactHero"
import { ContactImpressum } from "@/components/site/contact/ContactImpressum"
import { ContactMainPanel } from "@/components/site/contact/ContactMainPanel"
import { ContactTeamCards } from "@/components/site/contact/ContactTeamCards"
import { buildLocalBusinessJsonLd } from "@/lib/company"
import { CONTACT_FAQ } from "@/lib/team-data"
import { ROUTES } from "@/lib/routes"
import { absoluteUrl, buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.kapcsolat.title,
  description: ROUTES.kapcsolat.description,
  canonical: "/kapcsolat",
  ogImage: "/img/kapcsolat/hero.jpg",
})

function buildContactFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: CONTACT_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

export default function KapcsolatPage() {
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    pageUrl: absoluteUrl("/kapcsolat"),
  })
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Kezdőlap", path: "/" },
    { name: "Kapcsolat", path: "/kapcsolat" },
  ])
  const faqJsonLd = buildContactFaqJsonLd()

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-kapcsolat"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-localbusiness-kapcsolat"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Script
        id="jsonld-faq-kapcsolat"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <ContactHero />
      <ContactMainPanel />
      <ContactTeamCards />
      <ContactFaqSection />
      <ContactImpressum />
    </div>
  )
}
