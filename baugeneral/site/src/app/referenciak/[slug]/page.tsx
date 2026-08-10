import Link from "next/link"
import { notFound } from "next/navigation"
import Script from "next/script"
import { ReferenceDetailGallery } from "@/components/site/references/ReferenceDetailGallery"
import { ReferenceFactsStrip } from "@/components/site/references/ReferenceFactsStrip"
import { ReferenceThumbCard } from "@/components/site/references/ReferenceDetailParts"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { COMPANY, ORGANIZATION_ID } from "@/lib/company"
import {
  getReferenceBySlug,
  getReferenceDetailImages,
  getReferenceFactRows,
  getReferenceSeoDescription,
  getReferenceSlugs,
  getRelatedReferences,
  hasReferenceLead,
  hasReferenceNarrative,
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
    description: getReferenceSeoDescription(reference),
    canonical: referenceDetailPath(slug),
    ogImage: reference.heroImage.src,
  })
}

function buildReferenceJsonLd(reference: Reference) {
  const images = getReferenceDetailImages(reference)
    .slice(0, 8)
    .map((img) => ({
      "@type": "ImageObject" as const,
      contentUrl: absoluteUrl(img.src),
      url: absoluteUrl(img.src),
      description: img.alt,
    }))

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["CreativeWork", "WebPage"],
    "@id": absoluteUrl(`${referenceDetailPath(reference.slug)}#reference`),
    name: reference.title,
    headline: reference.title,
    description: getReferenceSeoDescription(reference),
    url: absoluteUrl(referenceDetailPath(reference.slug)),
    inLanguage: "hu-HU",
    isPartOf: { "@id": `${COMPANY.website}/#website` },
    creator: { "@id": ORGANIZATION_ID },
    provider: { "@id": ORGANIZATION_ID },
    image: images,
    primaryImageOfPage: images[0],
  }

  if (reference.yearCompleted > 0) {
    jsonLd.dateCreated = String(reference.yearCompleted)
    jsonLd.datePublished = `${reference.yearCompleted}-01-01`
  }

  if (reference.city && reference.city !== "—") {
    jsonLd.locationCreated = {
      "@type": "Place",
      name: reference.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: reference.city,
        addressRegion: reference.city.includes("Pest")
          ? "Pest"
          : "Bács-Kiskun",
        addressCountry: "HU",
      },
    }
  }

  return jsonLd
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
  const showLead = hasReferenceLead(reference)
  const showNarrative = hasReferenceNarrative(reference)

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

      {facts.length > 0 ? (
        <div className="mt-3">
          <ReferenceFactsStrip facts={facts} />
        </div>
      ) : null}

      <article className="mx-auto max-w-6xl px-4 py-5">
        {showLead ? (
          <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-black/65 md:text-base">
            {reference.tldr}
          </p>
        ) : null}

        {showNarrative ? (
          <div
            className={[
              "grid max-w-3xl gap-6 md:gap-7",
              showLead ? "mt-8" : "",
            ].join(" ")}
          >
            <section aria-labelledby="ref-challenge-heading">
              <h2
                id="ref-challenge-heading"
                className="text-sm font-semibold tracking-tight text-[var(--foreground)]"
              >
                A feladat
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">
                {reference.challenge}
              </p>
            </section>
            <section aria-labelledby="ref-solution-heading">
              <h2
                id="ref-solution-heading"
                className="text-sm font-semibold tracking-tight text-[var(--foreground)]"
              >
                Hogyan vittük
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">
                {reference.solution}
              </p>
            </section>
            <section aria-labelledby="ref-outcome-heading">
              <h2
                id="ref-outcome-heading"
                className="text-sm font-semibold tracking-tight text-[var(--foreground)]"
              >
                Eredmény
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">
                {reference.outcome}
              </p>
            </section>
          </div>
        ) : null}

        {related.length > 0 ? (
          <section
            aria-labelledby="related-references-heading"
            className={showLead || showNarrative ? "mt-10" : "mt-2"}
          >
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

        <p className="mt-6 text-sm text-black/55">
          Hasonló projektje van?{" "}
          {reference.type === "industrial" ? (
            <>
              <Link
                href="/szolgaltatasok/ipari-epuletek"
                className="font-semibold text-[var(--color-brand)] hover:underline"
              >
                Ipari épületek
              </Link>
              {" · "}
            </>
          ) : null}
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
