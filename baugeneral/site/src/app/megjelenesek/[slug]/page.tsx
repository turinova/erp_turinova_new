import Link from "next/link"
import { notFound } from "next/navigation"
import Script from "next/script"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import {
  formatPressDateHu,
  getPressBySlug,
  getPressSlugs,
  pressDetailPath,
  pressMetaTitle,
  buildPressDetailJsonLd,
} from "@/lib/press-appearances"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getPressSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const item = getPressBySlug(slug)
  if (!item) return {}

  return pageMetadata({
    title: pressMetaTitle(item),
    description: item.summary,
    canonical: pressDetailPath(slug),
    ogImage: item.imageSrc,
  })
}

export default async function PressDetailPage({ params }: PageProps) {
  const { slug } = await params
  const item = getPressBySlug(slug)
  if (!item) notFound()

  const breadcrumbs = [
    { name: "Főoldal", path: "/" },
    { name: "Megjelenések", path: "/megjelenesek" },
    { name: pressMetaTitle(item), path: pressDetailPath(item.slug) },
  ]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbs)
  const detailJsonLd = buildPressDetailJsonLd(item)

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-press-detail"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-webpage-press-detail"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(detailJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 pb-14 pt-4 md:pb-20">
        <Breadcrumbs items={breadcrumbs} />

        <article className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-black/50">
            {item.publisher}
            <span className="mx-1.5 text-black/25">·</span>
            {formatPressDateHu(item.publishedAt)}
            <span className="mx-1.5 text-black/25">·</span>
            {item.place}
          </p>

          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
            {item.title}
          </h1>

          {item.imageSrc ? (
            <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageSrc}
                alt={item.imageAlt ?? item.title}
                className="aspect-[16/10] w-full object-cover object-center"
              />
            </div>
          ) : null}

          <p className="mt-6 text-pretty text-base leading-relaxed text-black/75 md:text-lg">
            {item.summary}
          </p>

          <div className="mt-5 grid gap-4 text-pretty text-base leading-relaxed text-black/70">
            {item.body.map((para) => (
              <p key={para.slice(0, 48)}>{para}</p>
            ))}
          </div>

          <dl className="mt-8 grid gap-3 border-y border-black/10 py-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-black/45">Kivitelező</dt>
              <dd className="mt-0.5 font-medium text-black/85">BauGenerál Kft.</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-black/45">Helyszín</dt>
              <dd className="mt-0.5 font-medium text-black/85">{item.place}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-black/45">Forrás</dt>
              <dd className="mt-0.5 font-medium text-black/85">{item.publisher}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-black/45">Dátum</dt>
              <dd className="mt-0.5 font-medium text-black/85">
                {formatPressDateHu(item.publishedAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex px-5 py-2.5 text-sm font-semibold"
            >
              Eredeti cikk megnyitása
            </a>
            <Link
              href="/kapcsolat"
              className="btn-secondary inline-flex px-5 py-2.5 text-sm font-semibold"
            >
              Kapcsolat
            </Link>
          </div>

          <nav
            aria-label="Kapcsolódó oldalak"
            className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-black/10 pt-6 text-sm"
          >
            <Link
              href="/megjelenesek"
              className="font-medium text-[var(--color-brand)] underline-offset-4 hover:underline"
            >
              Összes megjelenés
            </Link>
            <Link
              href="/szolgaltatasok/kozepuletek"
              className="text-black/60 underline-offset-4 hover:text-black/85 hover:underline"
            >
              Középületek
            </Link>
            <Link
              href="/referenciak"
              className="text-black/60 underline-offset-4 hover:text-black/85 hover:underline"
            >
              Referenciák
            </Link>
            <Link
              href="/futo-projektek"
              className="text-black/60 underline-offset-4 hover:text-black/85 hover:underline"
            >
              Futó projektek
            </Link>
          </nav>
        </article>
      </div>
    </div>
  )
}
