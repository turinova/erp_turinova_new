import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import Script from "next/script"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import {
  AREA_SERVICE_CARDS,
  BACS_CITIES,
  BACS_CLUSTERS,
  BACS_FAQ,
  PEST_CITIES,
  PEST_CLUSTERS,
  PEST_FAQ,
  type AreaHubCluster,
  type AreaHubFaq,
} from "@/lib/area-hubs"
import { COMPANY, ORGANIZATION_ID } from "@/lib/company"
import { ROUTES, type RouteKey } from "@/lib/routes"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

type AreaHubPageProps = {
  routeKey: "pestMegye" | "bacsKiskun"
  areaName: string
  cities: readonly string[]
  faq: readonly AreaHubFaq[]
  clusters: readonly AreaHubCluster[]
  tldr: string
  whyTitle: string
  whyBody: string[]
  citiesHeading: string
  citiesIntro: string
  citiesNote: string
  ctaTitle: string
  ctaBody: string
  siblingHref: string
  siblingLabel: string
}

function buildFaqJsonLd(faq: readonly AreaHubFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

function buildServiceJsonLd(input: {
  name: string
  description: string
  path: string
  areaName: string
  cities: readonly string[]
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: `${COMPANY.website}${input.path}`,
    provider: { "@id": ORGANIZATION_ID },
    areaServed: [
      { "@type": "AdministrativeArea", name: input.areaName },
      ...input.cities.map((name) => ({ "@type": "City", name })),
    ],
    serviceType: "Generálkivitelezés",
  }
}

function AreaHubPage({
  routeKey,
  areaName,
  cities,
  faq,
  clusters,
  tldr,
  whyTitle,
  whyBody,
  citiesHeading,
  citiesIntro,
  citiesNote,
  ctaTitle,
  ctaBody,
  siblingHref,
  siblingLabel,
}: AreaHubPageProps) {
  const route = ROUTES[routeKey]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])
  const serviceJsonLd = buildServiceJsonLd({
    name: route.title,
    description: tldr,
    path: route.path,
    areaName,
    cities,
  })
  const faqJsonLd = buildFaqJsonLd(faq)
  const id = routeKey

  return (
    <div className="bg-white">
      <Script
        id={`jsonld-breadcrumb-${id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id={`jsonld-service-${id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Script
        id={`jsonld-faq-${id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:pt-5">
        <Breadcrumbs items={route.breadcrumbs} />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-4 md:pb-14 md:pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-black/45">
          Terület
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          {route.title}
        </h1>
        <p className="service-lead mt-4 max-w-2xl">{tldr}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/kapcsolat"
            className="btn-primary inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            Kapcsolat
          </Link>
          <Link
            href={siblingHref}
            className="btn-secondary inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            {siblingLabel}
          </Link>
        </div>
      </section>

      <section className="border-y border-black/8 bg-[var(--color-surface-soft)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <h2 className="service-h2">{whyTitle}</h2>
            {whyBody.map((p) => (
              <p key={p.slice(0, 24)} className="service-body mt-4">
                {p}
              </p>
            ))}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)]">
            <Image
              src={route.heroImage ?? "/img/nav/csaladi-haz.jpg"}
              alt={route.heroImageAlt ?? route.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="service-h2">{citiesHeading}</h2>
        <p className="service-body mt-3 max-w-2xl">{citiesIntro}</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cities.map((city) => (
            <li
              key={city}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-black/80"
            >
              {city}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-black/55">{citiesNote}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:pb-16">
        <h2 className="service-h2">Mit vállalunk itt?</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AREA_SERVICE_CARDS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-black/10 bg-white p-5 transition hover:border-[var(--color-brand)]"
            >
              <div className="text-lg font-semibold">{item.title}</div>
              <p className="mt-1 text-sm text-black/65">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-black/8 bg-[var(--color-surface-soft)]">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="service-h2">Gyakori helyi kérdések</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {clusters.map((c) => (
              <div key={c.title}>
                <h3 className="text-base font-semibold text-black/88">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/65">{c.body}</p>
                <Link
                  href={c.href}
                  className="mt-3 inline-block text-sm font-semibold text-[var(--color-brand)] underline-offset-2 hover:underline"
                >
                  {c.linkLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="service-h2">Gyakori kérdések</h2>
        <div className="mt-6 divide-y divide-black/10 border-t border-black/10">
          {faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-base font-semibold text-black/90 marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/65">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:pb-16">
        <div className="rounded-[var(--radius-lg)] border border-black/10 bg-[var(--color-surface-soft)] px-6 py-8 md:px-10 md:py-10">
          <h2 className="service-h2">{ctaTitle}</h2>
          <p className="service-body mt-3 max-w-xl">{ctaBody}</p>
          <Link
            href="/kapcsolat"
            className="btn-primary mt-6 inline-flex px-5 py-2.5 text-base font-semibold"
          >
            Kapcsolatfelvétel
          </Link>
        </div>
      </section>
    </div>
  )
}

export function buildAreaHubMetadata(routeKey: RouteKey): Metadata {
  const route = ROUTES[routeKey]
  return pageMetadata({
    title: route.title,
    description: route.description,
    canonical: route.path,
    ogImage: route.heroImage,
  })
}

export function PestMegyeHub() {
  return (
    <AreaHubPage
      routeKey="pestMegye"
      areaName="Pest megye és Budapest"
      cities={PEST_CITIES}
      faq={PEST_FAQ}
      clusters={PEST_CLUSTERS}
      tldr="A BauGenerál Kft. felújítást, szakági és generálkivitelezést vállal Pest megyében és Budapesten. Székhely: Kecskemét; helyszíni művezetés a projekt üteméhez igazítva. A lentebb szereplő települések példák, nem kizáró lista."
      whyTitle="Miért Pest megye és Budapest?"
      whyBody={[
        "A székhelyünk Kecskeméten van. Pest megyében és Budapesten felújítást, szakági és generál munkákat is vállalunk: a helyszíni művezetést a projekt üteméhez igazítjuk, egy kapcsolattartóval.",
        "Nem gyártunk településenkénti doorway-oldalakat. Ez az oldal a területet tisztázza: a megye és Budapest a vállalási keret; a konkrét településnevek példák. A szolgáltatás részletei a felújítás és a szakági oldalakon vannak.",
      ]}
      citiesHeading="Példa települések"
      citiesIntro="Többek között ezeken a helyeken és környékükön is dolgozunk. A lista nem teljes, és nem zár ki más Pest megyei vagy budapesti helyszínt."
      citiesNote="Más Pest megyei település vagy budapesti kerület is szóba jöhet. Írja meg az első üzenetben: megmondjuk, vállalható-e."
      ctaTitle="Budapesti vagy pest megyei projektet tervez?"
      ctaBody="Írja meg a települést vagy a kerületet és mit szeretne. Egy munkanapon belül válaszolunk."
      siblingHref="/generalkivitelezes-bacs-kiskun"
      siblingLabel="Bács-Kiskun megye"
    />
  )
}

export function BacsKiskunHub() {
  return (
    <AreaHubPage
      routeKey="bacsKiskun"
      areaName="Bács-Kiskun megye"
      cities={BACS_CITIES}
      faq={BACS_FAQ}
      clusters={BACS_CLUSTERS}
      tldr="A BauGenerál Kft. székhelye Kecskeméten van. Generálkivitelezés, felújítás, szakági és asztalos munkák Bács-Kiskun megyében szélesebb körben. A lentebb szereplő települések példák, nem kizáró lista."
      whyTitle="Miért Bács-Kiskun megye?"
      whyBody={[
        "Itt van a székhelyünk és a Hírös-Ablak bútorüzem is (Mindszenti krt. 10.). Kecskemét a kiindulópont, de a megyében több településen és környékén is vállalunk; a helyszíni művezetést a projekthez igazítjuk.",
        "Nem gyártunk településenkénti doorway-oldalakat. A lista példákat mutat. Pest megyében, Budapesten és a Balaton környékén is dolgozunk; a konkrét helyszínt az első megkereséskor egyeztetjük.",
      ]}
      citiesHeading="Példa települések"
      citiesIntro="Többek között ezeken a helyeken és környékükön is dolgozunk. A lista nem teljes, és nem zár ki más Bács-Kiskun megyei helyszínt."
      citiesNote="Más Bács-Kiskun megyei település is szóba jöhet. Írja meg az első üzenetben: megmondjuk, vállalható-e."
      ctaTitle="Bács-Kiskun megyei projektet tervez?"
      ctaBody="Írja meg a települést és mit szeretne. Egy munkanapon belül válaszolunk."
      siblingHref="/generalkivitelezes-pest-megye"
      siblingLabel="Pest megye és Budapest"
    />
  )
}
