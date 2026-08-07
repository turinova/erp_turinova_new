import Link from "next/link"
import { notFound } from "next/navigation"
import Script from "next/script"
import { ReferenceDetailGallery } from "@/components/site/references/ReferenceDetailGallery"
import { ReferenceFactsStrip } from "@/components/site/references/ReferenceFactsStrip"
import { ReferenceThumbCard } from "@/components/site/references/ReferenceDetailParts"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { COMPANY } from "@/lib/company"
import {
  getReferenceBySlug,
  getReferenceDetailImages,
  getReferenceFactRows,
  getReferenceSlugs,
  getRelatedReferences,
  referenceDetailPath,
  type Reference,
} from "@/lib/references"
import { absoluteUrl, buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getReferenceSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const reference = getReferenceBySlug(slug)
  if (!reference) return {}

  return pageMetadata({
    title: reference.title,
    description: reference.tldr,
    canonical: referenceDetailPath(slug),
    ogImage: reference.heroImage.src,
  })
}

function buildReferenceJsonLd(reference: Reference) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: reference.title,
    description: reference.tldr,
    dateCreated: String(reference.yearCompleted),
    locationCreated: {
      "@type": "Place",
      name: reference.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: reference.city,
        addressCountry: "HU",
      },
    },
    creator: {
      "@type": "Organization",
      name: COMPANY.shortName,
      url: COMPANY.website,
    },
    image: absoluteUrl(reference.heroImage.src),
    url: absoluteUrl(referenceDetailPath(reference.slug)),
  }
}

export default async function ReferenceDetailPage({ params }: PageProps) {
  const { slug } = await params
  const reference = getReferenceBySlug(slug)
  if (!reference) notFound()

  const related = getRelatedReferences(reference)
  const breadcrumbs = [
    { name: "Főoldal", path: "/" },
    { name: "Referenciák", path: "/referenciak" },
    { name: reference.title, path: referenceDetailPath(reference.slug) },
  ]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbs)
  const referenceJsonLd = buildReferenceJsonLd(reference)
  const images = getReferenceDetailImages(reference)
  const facts = getReferenceFactRows(reference)

  return (
    <div className="bg-stone-wash">
      <Script
        id={`jsonld-breadcrumb-ref-${reference.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id={`jsonld-reference-${reference.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(referenceJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Breadcrumbs items={breadcrumbs} />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-3">
        <ReferenceDetailGallery reference={reference} images={images} />
      </div>

      <div className="mt-3">
        <ReferenceFactsStrip facts={facts} />
      </div>

      <article className="mx-auto max-w-6xl px-4 py-5">
        <p className="max-w-3xl text-[0.875rem] leading-relaxed text-black/60">
          {reference.tldr}
        </p>

        {related.length > 0 ? (
          <section aria-labelledby="related-references-heading" className="mt-6">
            <h2
              id="related-references-heading"
              className="text-sm font-semibold text-black/55"
            >
              További referenciák
            </h2>
            <ul className="mt-2.5 grid grid-cols-3 gap-2 md:grid-cols-5">
              {related.map((item) => (
                <li key={item.slug}>
                  <ReferenceThumbCard reference={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-5 text-sm text-black/55">
          Hasonló projektje van?{" "}
          <Link
            href="/kapcsolat"
            className="font-semibold text-[var(--color-brand)] hover:underline"
          >
            Kapcsolatfelvétel →
          </Link>
        </p>
      </article>
    </div>
  )
}
