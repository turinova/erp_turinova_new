import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import Script from "next/script"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"
import { COMPANY, ORGANIZATION_ID } from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: ROUTES.pestMegye.title,
  description: ROUTES.pestMegye.description,
  canonical: ROUTES.pestMegye.path,
  ogImage: ROUTES.pestMegye.heroImage,
})

const CITIES = [
  "Üröm",
  "Solymár",
  "Pilisvörösvár",
  "Pilisborosjenő",
  "Budakalász",
  "Nagykovácsi",
  "Telki",
  "Budajenő",
] as const

const FAQ = [
  {
    q: "Vállal a BauGenerál építkezést Ürömön és Solymáron?",
    a: "Igen. Pest megyében és a budai agglomerációban — kiemelten Üröm, Solymár, Pilisvörösvár, Budakalász, Nagykovácsi térségében — vállalunk generálkivitelezést, szakági munkákat és asztalos munkákat. A székhelyünk Kecskeméten van; a helyszíni művezetést a projekt üteméhez igazítjuk.",
  },
  {
    q: "Milyen típusú projekteket vállalnak Pest megyében?",
    a: "Ipari és kereskedelmi épületeket, társasházakat, családi házakat, középületeket, felújításokat, valamint szakági (gépészet, villany, napelem, térkő) és asztalos munkákat.",
  },
  {
    q: "Mennyibe kerül a kiszállás Pest megyébe?",
    a: "Nincs külön publikus „kiszállási díjlista”. Az ajánlatban a helyszín és a projekt mérete alapján szerepel minden költség — átláthatóan, a szerződés előtt.",
  },
  {
    q: "Hogyan indul a kapcsolatfelvétel?",
    a: "Írjon a kapcsolat oldalon. Hamarosan emailben jelentkezünk, és egyeztetjük a helyszínt, a műszaki tartalmat és a következő lépést.",
  },
] as const

const TLDR =
  "A BauGenerál Kft. generálkivitelezést vállal Pest megyében és a budai agglomerációban — Üröm, Solymár és a környező településeken is. Ipari épületek, társasházak, családi házak, felújítások, szakági és asztalos munkák. Székhely: Kecskemét. Válasz: hamarosan emailben."

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

function buildServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Generálkivitelezés Pest megyében",
    description: TLDR,
    url: `${COMPANY.website}${ROUTES.pestMegye.path}`,
    provider: { "@id": ORGANIZATION_ID },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Pest megye" },
      ...CITIES.map((name) => ({ "@type": "City", name })),
    ],
    serviceType: "Generálkivitelezés",
  }
}

export default function PestMegyePage() {
  const route = ROUTES.pestMegye
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([...route.breadcrumbs])

  return (
    <div className="bg-white">
      <Script
        id="jsonld-breadcrumb-pest"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-service-pest"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildServiceJsonLd()) }}
      />
      <Script
        id="jsonld-faq-pest"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:pt-5">
        <Breadcrumbs items={route.breadcrumbs} />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 md:pb-14 md:pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
          Szolgáltatási terület
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl md:leading-[1.05]">
          Generálkivitelezés Pest megyében
        </h1>
        <p className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-black/70">
          {TLDR}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/kapcsolat"
            className="btn-primary inline-flex px-5 py-2.5 text-base font-semibold"
          >
            Írjon nekünk
          </Link>
          <Link
            href="/szolgaltatasok/ipari-epuletek"
            className="inline-flex items-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-base font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            Szolgáltatások
          </Link>
        </div>
      </section>

      <section className="border-y border-black/8 bg-[var(--color-surface-soft)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <h2 className="service-h2">
              Miért dolgozunk a budai agglomerációban?
            </h2>
            <p className="service-body mt-4">
              A BauGenerál székhelye Kecskeméten van, de Pest megye — különösen
              Üröm, Solymár és a Pilis–Budai hegyvidék agglomerációja — természetes
              kiterjesztése a tevékenységünknek. Helyszíni művezetéssel, egy
              felelős kapcsolattartóval és átlátható ütemmel dolgozunk.
            </p>
            <p className="service-body mt-4">
              Nem doorway-oldalakat gyártunk településenként: egy erős területi
              oldalon jelezzük, hol vállalunk — és a konkrét projektek a
              referenciákban és a futó munkáknál jelennek meg.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)]">
            <Image
              src={route.heroImage ?? "/img/nav/csaladi-haz.jpg"}
              alt={route.heroImageAlt ?? "Pest megyei generálkivitelezés"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="service-h2">Települések, ahol vállalunk</h2>
        <p className="service-body mt-3 max-w-2xl">
          A budai agglomeráció alábbi településein és környékükön vállalunk
          generálkivitelezést és kapcsolódó szakági / asztalos munkákat:
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CITIES.map((city) => (
            <li
              key={city}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-black/80"
            >
              {city}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-black/55">
          Más Pest megyei helyszín is szóba jöhet — írjon nekünk a részletekkel.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:pb-16">
        <h2 className="service-h2">Mit vállalunk Pest megyében?</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            {
              href: "/szolgaltatasok/ipari-epuletek",
              title: "Ipari épületek",
              text: "Csarnokok, autószalonok, kereskedelmi létesítmények.",
            },
            {
              href: "/szolgaltatasok/csaladi-haz-epites",
              title: "Családi házak",
              text: "Kulcsrakész kivitelezés, átlátható ütemmel.",
            },
            {
              href: "/szolgaltatasok/szakagi-kivitelezes",
              title: "Szakági kivitelezés",
              text: "Gépészet, villany, napelem, térkő — önállóan is.",
            },
            {
              href: "/szolgaltatasok/asztalos-munkak",
              title: "Asztalos munkák",
              text: "Egyedi bútor a Hírös-Ablak partnerüzemből.",
            },
          ].map((item) => (
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
          <h2 className="service-h2">Gyakori kérdések</h2>
          <div className="mt-6 divide-y divide-black/10 border-t border-black/10">
            {FAQ.map((item) => (
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="rounded-[var(--radius-lg)] border border-black/10 bg-[var(--color-surface-soft)] px-6 py-8 md:px-10 md:py-10">
          <h2 className="service-h2">Pest megyei projektet tervez?</h2>
          <p className="service-body mt-3 max-w-xl">
            Írjon nekünk Üröm, Solymár vagy más agglomerációs helyszínről —
            hamarosan emailben jelentkezünk.
          </p>
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
