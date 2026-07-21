import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import {
  buildBreadcrumbJsonLd,
  pageMetadata,
  absoluteUrl,
} from "@/lib/seo"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import { COMPANY } from "@/lib/company"
import { LINKS } from "@/lib/links"
import FaqAccordion from "@/components/szallitolada-keszites/FaqAccordion"
import NettfrontInomatFormMockup from "@/components/nettfront/NettfrontInomatFormMockup"
import {
  AI_ELEVATOR_PITCH,
  FAQ_ITEMS,
  NETTFRONT_PRODUCTS,
  HOWTO_STEPS,
  GALLERY_IMAGES,
  INOMAT_COLORS,
  INOMAT_COLOR_GROUPS,
  INOMAT_SECTION_LEAD,
  INOMAT_FACTS,
  OG_NETTFRONT_PATH,
  type InomatColor,
} from "@/lib/nettfront-landing-data"

const CANONICAL = "/szolgaltatasok/nettfront"

export const metadata: Metadata = pageMetadata({
  title: "NettFront bútorfront Kecskeméten",
  description:
    "NettFront frontok Kecskeméten: festett, fóliás, Inomat, Linea. Az Inomatot online is rendelheti, azonnali árral. Átvétel az áruházban.",
  canonical: CANONICAL,
  ogImage: absoluteUrl(OG_NETTFRONT_PATH),
})

const ctaPrimaryDark =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_28px_rgba(151,29,37,0.35)]"
const ctaSecondaryDark =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"
const ctaPrimaryLight =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition"

function ProductCardUi({ product }: { product: (typeof NETTFRONT_PRODUCTS)[number] }) {
  const isOnline = product.status === "available"
  return (
    <div
      className={`rounded-2xl border overflow-hidden bg-white ${
        isOnline
          ? "border-[var(--color-brand)]/50 shadow-[0_4px_20px_rgba(151,29,37,0.08)]"
          : "border-black/10"
      }`}
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 50vw, 25vw"
        />
      </div>
      <div className="p-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
            isOnline ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"
          }`}
        >
          {product.statusLabel}
        </span>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{product.title}</h3>
        <p className="mt-0.5 text-sm text-black/65">{product.subtitle}</p>
        {!isOnline ? (
          <p className="mt-1.5 text-xs text-black/45">Hamarosan online</p>
        ) : null}
      </div>
    </div>
  )
}

function ColorSwatch({ color }: { color: InomatColor }) {
  const isGloss = color.line === "pro-hg"
  return (
    <div className="rounded-xl border border-black/10 overflow-hidden bg-white">
      <div className="relative aspect-square">
        <Image
          src={color.image}
          alt={`NettFront Inomat ${color.name}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 25vw, 12vw"
        />
        {isGloss ? (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-black/10"
          />
        ) : null}
      </div>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-slate-900 leading-snug">{color.name}</p>
        <p className="text-[10px] text-black/50 mt-0.5">{color.dims}</p>
      </div>
    </div>
  )
}

export default function NettfrontPage() {
  const pageUrl = absoluteUrl(CANONICAL)

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "NettFront bútorfront Kecskeméten",
    serviceType: "NettFront bútorfront rendelés",
    description: AI_ELEVATOR_PITCH,
    url: pageUrl,
    provider: { "@id": `${COMPANY.website}/#localbusiness` },
    brand: { "@type": "Brand", name: "NettFront", url: "https://nettfront.hu" },
    areaServed: [
      { "@type": "City", name: "Kecskemét" },
      { "@type": "Country", name: "Magyarország" },
    ],
    audience: {
      "@type": "Audience",
      audienceType: "Asztalosok, bútorgyártók, belsőépítészek",
    },
    offers: {
      "@type": "Offer",
      url: LINKS.register,
      availability: "https://schema.org/InStock",
      priceCurrency: "HUF",
      description: "Inomat front online árazása regisztráció után, pánthelyfúrással",
    },
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "NettFront Inomat front online rendelése",
    description:
      "Inomat rendelés a Turinovában. Pánthelyfúrás a HÍRÖS-Ablaknál, átvétel Kecskeméten.",
    step: HOWTO_STEPS.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "NettFront fronttípusok",
    itemListElement: NETTFRONT_PRODUCTS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      description: `${p.statusLabel}. ${p.subtitle}`,
    })),
  }

  const inomatColorsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "NettFront Inomat színek",
    numberOfItems: INOMAT_COLORS.length,
    itemListElement: INOMAT_COLORS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      description: `${c.lineLabel}, ${c.dims}`,
      url: absoluteUrl(c.image),
    })),
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Szolgáltatások", path: "/szolgaltatasok/lapszabaszat-es-elzaras" },
    { name: "NettFront", path: CANONICAL },
  ])

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "NettFront bútorfront Kecskeméten",
    description: AI_ELEVATOR_PITCH,
    url: pageUrl,
    inLanguage: "hu-HU",
    isPartOf: { "@id": `${COMPANY.website}/#website` },
    about: [
      { "@type": "Brand", name: "NettFront" },
      { "@type": "Thing", name: "Inomat Basic" },
      { "@type": "Thing", name: "Inomat Pro" },
      { "@type": "Thing", name: "Inomat bútorfront" },
      { "@type": "Thing", name: "Festett bútorfront" },
      { "@type": "Thing", name: "Fóliás bútorfront" },
      { "@type": "Thing", name: "Linea bordázott front" },
    ],
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".ai-elevator-pitch", ".ai-inomat-lead", ".faq-answer-first"],
    },
  }

  return (
    <div className="relative">
      <Script id="jsonld-service-nettfront" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <Script id="jsonld-faq-nettfront" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="jsonld-howto-nettfront" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <Script id="jsonld-itemlist-nettfront" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Script id="jsonld-inomat-colors" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(inomatColorsJsonLd) }} />
      <Script id="jsonld-breadcrumb-nettfront" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Script id="jsonld-webpage-nettfront" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />

      <RevealOnLoad>
        {/* 1. HERO */}
        <section className="relative isolate min-h-[70vh] flex items-end overflow-hidden">
          <Image
            src="/img/nettfront/inomat.png"
            alt="NettFront Inomat bútorfrontok modern konyhában Kecskemét"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20"
          />

          <div className="relative z-10 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 pt-28 sm:pb-14 sm:pt-32">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                  Kecskemét · NettFront partner
                </p>
                <span className="inline-flex items-center rounded-md bg-white/95 px-2.5 py-1 shadow-sm">
                  <Image
                    src="/brands/nettfront-logo.svg"
                    alt="NettFront"
                    width={742}
                    height={324}
                    style={{ height: "auto", width: "88px" }}
                    priority
                  />
                </span>
              </div>

              <h1 className="mt-5 text-balance text-4xl md:text-5xl font-semibold tracking-tight text-white">
                NettFront frontok Kecskeméten
              </h1>
              <div className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]" aria-hidden />

              <p className="ai-elevator-pitch mt-4 max-w-xl text-pretty text-base md:text-lg text-white/85">
                {AI_ELEVATOR_PITCH}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href={LINKS.register} target="_blank" rel="noreferrer" className={ctaPrimaryDark}>
                  Inomat online ajánlat
                </a>
                <a href="#termekek" className={ctaSecondaryDark}>
                  Termékek
                </a>
              </div>

              <p className="mt-5 text-xs text-white/55">
                Átvétel Kecskeméten · Nincs minimum
              </p>
            </div>
          </div>
        </section>

        {/* 2. GALLERY */}
        <section className="bg-stone-950 py-3 sm:py-4">
          <div className="mx-auto max-w-7xl px-3 sm:px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {GALLERY_IMAGES.map((img) => (
                <div
                  key={img.src}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg sm:rounded-xl"
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 50vw, 25vw"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. PRODUCTS */}
        <section id="termekek" className="bg-stone-wash py-8 md:py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                Mit rendelhet nálunk?
              </h2>
              <div className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]" aria-hidden />
              <p className="mt-3 max-w-2xl text-base text-black/75">
                Festett, fóliás, Inomat és Linea. Online most az Inomat; a többi személyesen,
                hamarosan ugyanitt.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={0.08} className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {NETTFRONT_PRODUCTS.map((p) => (
                <ProductCardUi key={p.id} product={p} />
              ))}
            </RevealOnScroll>
          </div>
        </section>

        {/* 4. INOMAT ONLINE + HOWTO + COLORS */}
        <section id="inomat-online" className="py-8 md:py-10 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <RevealOnScroll>
                <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Inomatot online is
                </h2>
                <div className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]" aria-hidden />
                <p className="ai-inomat-lead mt-3 text-base text-black/75">
                  {INOMAT_SECTION_LEAD}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {INOMAT_FACTS.map((f) => (
                    <li key={f} className="text-sm text-black/70 flex gap-2">
                      <span className="text-[var(--color-brand)] shrink-0">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={LINKS.register}
                  target="_blank"
                  rel="noreferrer"
                  className={`${ctaPrimaryLight} mt-6`}
                >
                  Online árajánlat, kb. 5 perc
                </a>
              </RevealOnScroll>
              <RevealOnScroll delay={0.08}>
                <NettfrontInomatFormMockup />
              </RevealOnScroll>
            </div>

            {/* Visible HowTo */}
            <RevealOnScroll delay={0.1} className="mt-10">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                Így rendel Inomatot
              </h3>
              <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {HOWTO_STEPS.map((step, i) => (
                  <li
                    key={step.name}
                    className="rounded-xl border border-black/10 bg-stone-50 p-4"
                  >
                    <p className="text-xs font-bold text-[var(--color-brand)]">
                      {i + 1}. {step.name}
                    </p>
                    <p className="mt-1.5 text-sm text-black/70 leading-snug">{step.text}</p>
                  </li>
                ))}
              </ol>
            </RevealOnScroll>

            {/* Color cards */}
            <div id="inomat-szinek" className="mt-10">
              <RevealOnScroll delay={0.12}>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                  Inomat színek
                </h3>
                <p className="mt-2 text-sm text-black/65 max-w-2xl">
                  Basic 2, Pro High Gloss 4, Pro Matt 12 szín. A minták tájékoztató jellegűek; a
                  valós szín eltérhet.
                </p>

                <div className="mt-6 space-y-8">
                  {INOMAT_COLOR_GROUPS.map((group) => {
                    const colors = INOMAT_COLORS.filter((c) => c.line === group.id)
                    return (
                      <div key={group.id}>
                        <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                        <p className="mt-1 text-xs text-black/55 max-w-2xl">{group.lead}</p>
                        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                          {colors.map((c) => (
                            <ColorSwatch key={c.id} color={c} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* 5. FAQ */}
        <section className="bg-stone-wash py-8 md:py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                Gyakori kérdések
              </h2>
              <div className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]" aria-hidden />
            </RevealOnScroll>
            <RevealOnScroll delay={0.08} className="mt-6">
              <div className="faq-answer-first">
                <FaqAccordion items={[...FAQ_ITEMS]} />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* 6. CTA */}
        <section className="relative isolate overflow-hidden py-12 md:py-14">
          <Image
            src="/img/nettfront/inomat.png"
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            aria-hidden
          />
          <div aria-hidden className="absolute inset-0 bg-black/70" />
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <Image
              src="/brands/nettfront-logo.svg"
              alt="NettFront"
              width={742}
              height={324}
              className="mx-auto brightness-0 invert opacity-95"
              style={{ height: "auto", width: "120px" }}
            />
            <h2 className="mt-5 text-balance text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Inomat ajánlat kb. 5 perc alatt
            </h2>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a href={LINKS.register} target="_blank" rel="noreferrer" className={ctaPrimaryDark}>
                Online árajánlat
              </a>
              <Link href="/szolgaltatasok/online-lapszabaszat" className={ctaSecondaryDark}>
                Online lapszabászat
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/55">
              Turinova · HÍRÖS-Ablak Kft. · {COMPANY.address.city}, 1996 óta
            </p>
          </div>
        </section>
      </RevealOnLoad>
    </div>
  )
}
