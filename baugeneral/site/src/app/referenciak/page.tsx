import { Suspense } from "react"
import Script from "next/script"
import { ReferencesBrowse } from "@/components/site/references/ReferencesBrowse"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { getPublishedReferences } from "@/lib/references"
import { ROUTES } from "@/lib/routes"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.referenciak.title,
  description: ROUTES.referenciak.description,
  canonical: "/referenciak",
  ogImage: "/img/szolgaltatasok/ipari-epuletek.jpg",
})

function BrowseFallback({ count }: { count: number }) {
  return (
    <div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-black/5"
          />
        ))}
      </div>
      <p className="mt-5 text-sm text-black/45">{count} referencia betöltése…</p>
    </div>
  )
}

export default function ReferenciakPage() {
  const route = ROUTES.referenciak
  const references = getPublishedReferences()
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-referenciak"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 md:pb-16">
        <Breadcrumbs items={route.breadcrumbs} />

        <h1 id="referenciak-heading" className="about-h1 mt-4">
          Referenciák
        </h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-black/60 md:text-base">
          Befejezett projektek Kecskeméten és Bács-Kiskunban —{" "}
          {references.length} publikus referencia, típus szerint
          böngészhető.
        </p>

        <div className="mt-6">
          <Suspense fallback={<BrowseFallback count={references.length} />}>
            <ReferencesBrowse references={references} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
