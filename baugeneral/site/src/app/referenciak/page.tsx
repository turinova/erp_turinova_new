import Script from "next/script"
import { ReferencesBrowse } from "@/components/site/references/ReferencesBrowse"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { COMPANY } from "@/lib/company"
import {
  getPublishedReferences,
  referenceDetailPath,
} from "@/lib/references"
import { ROUTES } from "@/lib/routes"
import { absoluteUrl, buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.referenciak.title,
  description: ROUTES.referenciak.description,
  canonical: "/referenciak",
  ogImage: "/img/szolgaltatasok/ipari-epuletek.jpg",
})

function buildReferencesCollectionJsonLd(
  references: ReturnType<typeof getPublishedReferences>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/referenciak#collection"),
    name: ROUTES.referenciak.title,
    description: ROUTES.referenciak.description,
    url: absoluteUrl("/referenciak"),
    inLanguage: "hu-HU",
    isPartOf: { "@id": `${COMPANY.website}/#website` },
    mainEntity: {
      "@type": "ItemList",
      name: "BauGenerál referenciák",
      numberOfItems: references.length,
      itemListElement: references.map((reference, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: reference.title,
        url: absoluteUrl(referenceDetailPath(reference.slug)),
        image: absoluteUrl(reference.cardImage.src),
      })),
    },
  }
}

export default function ReferenciakPage() {
  const route = ROUTES.referenciak
  const references = getPublishedReferences()
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])
  const collectionJsonLd = buildReferencesCollectionJsonLd(references)

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-referenciak"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-collection-referenciak"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 md:pb-16">
        <Breadcrumbs items={route.breadcrumbs} />

        <h1 id="referenciak-heading" className="about-h1 mt-4">
          Referenciák
        </h1>

        <div className="mt-6">
          <ReferencesBrowse references={references} />
        </div>
      </div>
    </div>
  )
}
