import Script from "next/script"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { PressAppearancesList } from "@/components/site/press/PressAppearancesList"
import { PressFaqSection } from "@/components/site/press/PressFaqSection"
import {
  PRESS_PAGE_ENTITY_LINE,
  buildPressCollectionJsonLd,
  buildPressFaqJsonLd,
  getPressAppearances,
} from "@/lib/press-appearances"
import { ROUTES } from "@/lib/routes"
import { absoluteUrl, buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.megjelenesek.title,
  description: ROUTES.megjelenesek.description,
  canonical: ROUTES.megjelenesek.path,
})

export default function MegjelenesekPage() {
  const route = ROUTES.megjelenesek
  const items = getPressAppearances()
  const pageUrl = absoluteUrl(route.path)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])
  const collectionJsonLd = buildPressCollectionJsonLd(items, pageUrl)
  const faqJsonLd = buildPressFaqJsonLd()

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-megjelenesek"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-collection-megjelenesek"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <Script
        id="jsonld-faq-megjelenesek"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-4 md:pb-20">
        <Breadcrumbs items={route.breadcrumbs} />

        <header className="mt-4 max-w-3xl">
          <h1
            id="megjelenesek-heading"
            className="font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl"
          >
            BauGenerál sajtómegjelenések Bács-Kiskunban
          </h1>
          <p className="mt-2 text-sm text-black/55 md:text-base">
            {PRESS_PAGE_ENTITY_LINE}
          </p>
        </header>

        <PressAppearancesList items={items} />
        <PressFaqSection />
      </div>
    </div>
  )
}
