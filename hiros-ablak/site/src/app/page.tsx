import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import type { Metadata } from "next"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"
import { TrustindexWidget } from "@/components/site/TrustindexWidget"
import FaqAccordion from "@/components/szallitolada-keszites/FaqAccordion"
import {
  COMPANY,
  buildLocalBusinessJsonLd,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
} from "@/lib/company"
import { LINKS } from "@/lib/links"
import { getSupabaseServerClient } from "@/lib/supabase"
import {
  HOME_BRAND_CHIPS,
  HOME_FAQ,
  HOME_HERITAGE_PHOTO,
  HOME_HERITAGE_STATS,
  HOME_HERITAGE_STORY,
  HOME_HERO_IMAGE,
  HOME_HERO_PROMISES,
  HOME_PROCESS,
  HOME_SERVICE_PILLARS,
  HOME_SHOWROOM_BULLETS,
  HOME_SHOWROOM_PHOTO,
} from "@/lib/home-data"
import { TRUST_STATS, VASALATMESTER_URL } from "@/lib/footer-data"
import { DEFAULT_OG_IMAGE_PATH, pageMetadata } from "@/lib/seo"

const TRUSTINDEX_WIDGET_ID = "7cdec6847a44162c96468ea0aea"

export const metadata: Metadata = pageMetadata({
  title: "Bútorlap, munkalap és lapszabászat Kecskeméten · Hírös-Ablak Kft.",
  description:
    "Lapszabászat, élzárás és bútorlap Kecskeméten 1996 óta. 30+ márka raktáron (Egger, Kronospan, Blum, Hettich). 500 m² bemutatóterem, saját üzem, asztalos partnerprogram, online árajánlat 2 perc alatt.",
  canonical: "/",
  ogImage: DEFAULT_OG_IMAGE_PATH,
})

const PAGE_SIZE = 6
/** In-stock decors to shuffle before picking PAGE_SIZE for the homepage preview. */
const PREVIEW_POOL_SIZE = 60

/** New random preview on each request (no static ISR cache). */
export const dynamic = "force-dynamic"

const ctaPrimaryDark =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_28px_rgba(151,29,37,0.35)]"
const ctaSecondaryDark =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"
const ctaSecondaryDarkSolid =
  "inline-flex items-center justify-center rounded-full border border-white bg-white px-6 py-3 text-base font-semibold text-slate-900 hover:bg-white/95 transition shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
const ctaPrimary =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_22px_rgba(151,29,37,0.30)]"
const ctaSecondary =
  "inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-base font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 items-center justify-center shrink-0"
      >
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <span className="text-sm sm:text-base text-white leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
        {children}
      </span>
    </li>
  )
}

function HeroPromiseIcon({ name }: { name: "home" | "cog" | "users" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-5h4v5" />
      </svg>
    )
  }
  if (name === "cog") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckBulletDark({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] items-center justify-center shrink-0"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <span className="text-sm sm:text-base text-black/80 leading-snug">
        {children}
      </span>
    </li>
  )
}

type PreviewRow = {
  id: string
  slug: string | null
  name: string
  brand_name: string | null
  thickness_mm: number
  image_url: string | null
  on_stock: boolean
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

async function fetchCatalogPreview(): Promise<PreviewRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return []
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase
      .from("public_butorlap")
      .select("id, slug, name, brand_name, thickness_mm, image_url, on_stock")
      .eq("on_stock", true)
      .not("image_url", "is", null)
      .limit(PREVIEW_POOL_SIZE)
    if (error || !data?.length) return []
    return shuffle(data as PreviewRow[]).slice(0, PAGE_SIZE)
  } catch {
    return []
  }
}

function buildButorlapHref(r: PreviewRow): string {
  return `/butorlap/${r.slug ?? `id-${r.id}`}`
}

// ────────────────────────────────────────────────────────────────────────────
// JSON-LD builders specific to homepage (FAQPage + WebSite)
// ────────────────────────────────────────────────────────────────────────────

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  }
}

function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${COMPANY.website}/#website`,
    name: COMPANY.brand,
    url: COMPANY.website,
    inLanguage: "hu-HU",
    publisher: { "@id": `${COMPANY.website}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${COMPANY.website}/butorlap?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export default async function HomePage() {
  const preview = await fetchCatalogPreview()
  const mapEmbed = googleMapsEmbedUrl()
  const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)
  const faqJsonLd = buildFaqJsonLd()
  const websiteJsonLd = buildWebSiteJsonLd()
  const localBusinessJsonLd = buildLocalBusinessJsonLd()

  return (
    <div className="relative bg-stone-wash">
      <Script
        id="jsonld-faq-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="jsonld-website-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <Script
        id="jsonld-localbusiness-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />

      <RevealOnLoad>
        {/* ─────────────────────────── 01 — HERO ─────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative isolate overflow-hidden"
          data-reveal
        >
          <Image
            src={HOME_HERO_IMAGE.src}
            alt={HOME_HERO_IMAGE.alt}
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/55 to-black/25"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -left-32 -z-10 h-[560px] w-[560px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.32) 0%, transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-24 -z-10 h-[420px] w-[640px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.18) 0%, transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
            <div className="grid gap-8 md:grid-cols-12 md:items-center">
              <div className="md:col-span-7">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full bg-[var(--color-brand)] ring-2 ring-white/90"
                  />
                  Kecskemét, {COMPANY.address.street} · 1996 óta
                </p>

                <h1
                  id="hero-heading"
                  className="mt-5 text-balance text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
                >
                  Bútorlap és lapszabászat Kecskeméten 1996 óta
                </h1>

                <div
                  aria-hidden
                  className="mt-4 h-2 w-28 rounded-full bg-[var(--color-brand)]"
                />

                <p className="mt-5 max-w-2xl text-pretty text-base md:text-lg text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  Lapszabászat, élzárás, barkácsáruház és egyedi megoldások
                  Kecskeméten, egy helyen, 1996 óta.
                </p>

                <ul className="mt-6 grid gap-2.5 max-w-xl">
                  <CheckBullet>
                    Nyitva szombat délelőtt is
                  </CheckBullet>
                  <CheckBullet>
                    Egger, Kronospan, Blum: 30+ márka raktárról
                  </CheckBullet>
                  <CheckBullet>
                    2 perces online árajánlat, SMS amint elkészült
                  </CheckBullet>
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    href={LINKS.onlineOrdering}
                    target="_blank"
                    rel="noreferrer"
                    className={ctaPrimaryDark}
                  >
                    Online árajánlat
                  </a>
                  <Link href="/butorlap" className={ctaSecondaryDarkSolid}>
                    Katalógus
                  </Link>
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
                    </svg>
                    Hívás: {phoneDisplay}
                  </a>
                </div>
              </div>

              {/* Side card: hero identity statements */}
              <div className="md:col-span-5">
                <div className="rounded-2xl border border-white/20 bg-black/45 p-5 backdrop-blur-md md:p-6">
                  <ul className="grid gap-4">
                    {HOME_HERO_PROMISES.map((p) => (
                      <li key={p.icon} className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white"
                        >
                          <HeroPromiseIcon name={p.icon} />
                        </span>
                        <span className="text-sm md:text-base font-semibold leading-snug text-white">
                          {p.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 border-t border-white/20 pt-4">
                    <OpeningHoursPill />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────── 02 — TRUST STRIP ─────────────────────────── */}
        <section
          aria-label="Bizalmi mutatók"
          className="border-b border-black/10 bg-stone-wash py-7 md:py-8"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 md:gap-6">
              {TRUST_STATS.map((s) => (
                <li
                  key={s.label}
                  className="flex items-baseline gap-2 border-l-[3px] border-[var(--color-brand)]/45 pl-3"
                >
                  <span className="text-xl md:text-2xl font-bold tabular-nums text-[var(--color-brand)]">
                    {s.number}
                  </span>
                  <span className="text-xs md:text-sm text-black/70 leading-tight">
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─────────────── 03 — SERVICE PILLARS (3 image cards) ──────────── */}
        <section
          aria-label="Szolgáltatásaink"
          className="bg-white py-14 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  Kecskeméten, egy helyen
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Lapszabászat, élzárás, barkácsáruház és egyedi megoldások
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
                <p className="mt-4 text-base text-black/70">
                  Méretre vágjuk és élzárjuk a paneleket, áruházunkból a
                  vasalat és szerszám raktárról vihető, egyedi szállítóládákat
                  és ipari megoldásokat pedig üzemünkben készítünk.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-5 md:grid-cols-3">
                {HOME_SERVICE_PILLARS.map((p) => (
                  <Link
                    key={p.href + p.title}
                    href={p.href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:-translate-y-1 hover:border-[var(--color-brand)]/40 hover:shadow-[0_18px_40px_rgba(151,29,37,0.18)]"
                  >
                    <div className="relative aspect-[5/3] w-full overflow-hidden bg-stone-100">
                      <Image
                        src={p.image}
                        alt={p.imageAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent"
                      />
                      <div className="absolute left-4 bottom-3 text-[11px] uppercase tracking-wide text-white/85">
                        {p.label}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-xl font-semibold tracking-tight text-slate-900 group-hover:text-[var(--color-brand)] transition-colors">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-sm text-black/70 leading-relaxed">
                        {p.description}
                      </p>
                      <ul className="mt-4 grid gap-1.5">
                        {p.bullets.map((b) => (
                          <li
                            key={b}
                            className="flex items-center gap-2 text-xs text-black/65"
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]"
                            />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-5 text-sm font-semibold text-[var(--color-brand)]">
                        {p.cta} →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────── 04 — CATALOG PREVIEW + BRAND CARPET ─────────── */}
        <section
          aria-label="Katalógus betekintő"
          className="border-y border-black/10 bg-stone-wash py-14 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                    Anyagkatalógus
                  </p>
                  <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                    Találja meg a dekort
                  </h2>
                  <div
                    aria-hidden
                    className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  />
                  <p className="mt-4 text-base text-black/70">
                    Alább néhány raktáron lévő tétel látható. Online
                    katalógusunkban több mint 800 bútorlap-dekor böngészhető,
                    raktáron vagy beszerezhetőként jelölve.
                  </p>
                </div>
                <Link
                  href="/butorlap"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)] hover:underline underline-offset-4"
                >
                  Teljes katalógus →
                </Link>
              </div>
            </RevealOnScroll>

            {preview.length > 0 ? (
              <RevealOnScroll delay={0.1} className="mt-8">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
                  {preview.map((r) => (
                    <Link
                      key={r.id}
                      href={buildButorlapHref(r)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:-translate-y-1 hover:border-[var(--color-brand)]/40 hover:shadow-[0_12px_28px_rgba(151,29,37,0.15)]"
                    >
                      <div className="relative aspect-[4/3] w-full bg-stone-50">
                        <Image
                          src={r.image_url ?? "/img/hiros_logo.png"}
                          alt={`${r.name} bútorlap`}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                        <div className="absolute right-2 top-2 inline-flex items-center rounded-full border border-[var(--color-brand)]/25 bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-brand)] backdrop-blur">
                          {r.thickness_mm} mm
                        </div>
                      </div>
                      <div className="flex flex-col p-3">
                        <div className="text-[13px] font-semibold leading-snug text-slate-900 line-clamp-2 group-hover:text-[var(--color-brand)] transition-colors">
                          {r.name}
                        </div>
                        {r.brand_name && (
                          <div className="mt-1 text-[11px] text-black/55">
                            {r.brand_name}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </RevealOnScroll>
            ) : null}

            {/* Brand carpet */}
            <RevealOnScroll delay={0.15} className="mt-10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-black/55 md:w-44 md:shrink-0">
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-2 w-6 rounded-full bg-[var(--color-brand)]/80 align-middle"
                  />
                  Márkáink
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {HOME_BRAND_CHIPS.map((b) => (
                    <li key={b.name}>
                      <Link
                        href={b.href}
                        className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/80 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white hover:shadow-[0_6px_14px_rgba(151,29,37,0.25)]"
                      >
                        {b.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────────── 05 — ÍGY DOLGOZUNK (process) ──────────────── */}
        <section
          aria-label="Folyamat"
          className="bg-white py-14 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-3xl mx-auto text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  Így dolgozunk
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Választástól átvételig négy lépésben
                </h2>
                <div
                  aria-hidden
                  className="mx-auto mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-12">
              <div className="relative">
                {/* Connecting line on desktop */}
                <div
                  aria-hidden
                  className="absolute left-0 right-0 top-7 hidden h-px md:block"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-brand) 35%, transparent), transparent)",
                  }}
                />
                <ol className="grid gap-6 md:grid-cols-4">
                  {HOME_PROCESS.map((step) => (
                    <li
                      key={step.number}
                      className="relative rounded-2xl border border-black/10 bg-white p-6 transition hover:border-[var(--color-brand)]/40 hover:shadow-[0_10px_28px_rgba(151,29,37,0.12)]"
                    >
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand)] text-2xl font-bold text-[var(--color-brand-contrast)] shadow-[0_8px_20px_rgba(151,29,37,0.32)]">
                        {step.number}
                      </div>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm text-black/70 leading-relaxed">
                        {step.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.15} className="mt-10">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={LINKS.onlineOrdering}
                  target="_blank"
                  rel="noreferrer"
                  className={ctaPrimary}
                >
                  Online árajánlat
                </a>
                <Link href="/kapcsolat" className={ctaSecondary}>
                  Inkább érdeklődöm
                </Link>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────────── 05B — HERITAGE STORY ────────────────────────── */}
        <section
          aria-label="A Hírös-Ablak története"
          className="relative overflow-hidden bg-stone-wash py-14 md:py-20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 -z-0 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.10) 0%, transparent 65%)",
            }}
          />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  30 év Kecskeméten
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  A Hírös-Ablak története
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 lg:items-center">
                <div className="lg:col-span-7">
                  <div className="space-y-5 text-base md:text-lg text-black/80 leading-relaxed">
                    {HOME_HERITAGE_STORY.map((p, i) => (
                      <p
                        key={i}
                        className={
                          i === 0
                            ? "first-letter:text-3xl first-letter:font-semibold first-letter:text-[var(--color-brand)] first-letter:mr-1 first-letter:float-left first-letter:leading-[0.9]"
                            : ""
                        }
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/10 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
                    <Image
                      src={HOME_HERITAGE_PHOTO.src}
                      alt={HOME_HERITAGE_PHOTO.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 42vw"
                      className="object-cover"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
                    />
                    <div className="absolute left-5 right-5 bottom-4 text-white">
                      <div className="text-[11px] uppercase tracking-wide text-white/75">
                        Mindszenti krt. 10. · 1996 óta
                      </div>
                      <div className="text-base font-semibold leading-snug">
                        Kecskemét
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.15} className="mt-12">
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {HOME_HERITAGE_STATS.map((s) => (
                  <li
                    key={s.label}
                    className="rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-brand)]/40 hover:shadow-[0_10px_24px_rgba(151,29,37,0.10)]"
                  >
                    <div className="text-2xl md:text-3xl font-bold tabular-nums text-[var(--color-brand)] leading-none">
                      {s.number}
                    </div>
                    <div className="mt-2 text-xs md:text-sm text-black/65 leading-snug">
                      {s.label}
                    </div>
                  </li>
                ))}
              </ul>
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────────── 05C — GYORS TÉNYEK (AI / SEO) ─────────────── */}
        <section
          aria-label="Gyors tények a Hírös-Ablakról"
          className="border-y border-black/10 bg-white py-10 md:py-12"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Gyors tények
            </h2>
            <dl className="mt-4 grid gap-3 text-sm text-black/80 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-medium text-black/55">Cég</dt>
                <dd>{COMPANY.legalName}</dd>
              </div>
              <div>
                <dt className="font-medium text-black/55">Cím</dt>
                <dd>
                  {COMPANY.address.postalCode} {COMPANY.address.city},{" "}
                  {COMPANY.address.street}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-black/55">Telefon</dt>
                <dd>
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="underline underline-offset-4 hover:text-[var(--color-brand)]"
                  >
                    {formatPhoneDisplay(COMPANY.phones.primary)}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-black/55">Alapítva</dt>
                <dd>1996 · Kecskemét</dd>
              </div>
              <div>
                <dt className="font-medium text-black/55">Szolgáltatások</dt>
                <dd>
                  Bútorlap, lapszabászat, élzárás, barkácsáruház, online
                  árajánlat
                </dd>
              </div>
              <div>
                <dt className="font-medium text-black/55">Web</dt>
                <dd>
                  <a
                    href={COMPANY.website}
                    className="underline underline-offset-4 hover:text-[var(--color-brand)]"
                  >
                    {COMPANY.website.replace(/^https:\/\//, "")}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ─────────────────── 06 — SHOWROOM INVITE (50/50) ──────────────── */}
        <section
          aria-label="Bemutatóterem"
          className="bg-white py-14 md:py-20 border-y border-black/10"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
                <div className="lg:col-span-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                    Térjen be személyesen
                  </p>
                  <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                    500 m²-en várjuk Kecskeméten
                  </h2>
                  <div
                    aria-hidden
                    className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  />
                  <p className="mt-5 text-base text-black/75 leading-relaxed">
                    Élőben kézbe veszi a dekort, az élzárót, a vasalatot. Ha
                    bizonytalan a darabolási listával, vagy csak látni szeretne
                    egy mintát: szívesen segítünk.
                  </p>

                  <ul className="mt-6 grid gap-2.5 max-w-lg">
                    {HOME_SHOWROOM_BULLETS.map((b) => (
                      <CheckBulletDark key={b}>{b}</CheckBulletDark>
                    ))}
                  </ul>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      href="/barkacsaruhaz-kecskemet"
                      className={ctaPrimary}
                    >
                      Áruház részletek
                    </Link>
                    <a
                      href={googleMapsDirectionsUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className={ctaSecondary}
                    >
                      Útvonal
                    </a>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="group relative overflow-hidden rounded-2xl border border-black/10 shadow-[0_16px_40px_rgba(0,0,0,0.10)]">
                    <div className="relative aspect-[4/3] w-full bg-stone-100">
                      <Image
                        src={HOME_SHOWROOM_PHOTO.src}
                        alt={HOME_SHOWROOM_PHOTO.alt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
                      />
                      <div className="absolute left-5 right-5 bottom-4 flex items-end justify-between gap-3 text-white">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-white/75">
                            Üzletünk címe
                          </div>
                          <div className="text-base font-semibold leading-snug md:text-lg">
                            {COMPANY.address.full}
                          </div>
                        </div>
                        <span
                          aria-hidden
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand)] text-white shadow-md"
                        >
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────────── 07 — CONTACT + MAP (50/50) ────────────────── */}
        <section
          aria-label="Kapcsolat és térkép"
          className="bg-stone-wash py-14 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  Kapcsolat
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Hol talál minket
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-6 md:grid-cols-12 md:gap-8">
                {/* Left: NAP card */}
                <div className="md:col-span-5">
                  <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Cím
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {COMPANY.address.full}
                    </div>

                    <hr className="my-5 border-t border-black/10" />

                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Telefon
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <a
                        className="text-base font-semibold text-slate-900 hover:text-[var(--color-brand)]"
                        href={`tel:${COMPANY.phones.primary}`}
                      >
                        {formatPhoneDisplay(COMPANY.phones.primary)}
                        <span className="ml-2 text-xs font-normal text-black/45">
                          központ
                        </span>
                      </a>
                      <a
                        className="text-base font-semibold text-slate-900 hover:text-[var(--color-brand)]"
                        href={`tel:${COMPANY.phones.secondary}`}
                      >
                        {formatPhoneDisplay(COMPANY.phones.secondary)}
                        <span className="ml-2 text-xs font-normal text-black/45">
                          másik vonal
                        </span>
                      </a>
                    </div>

                    <hr className="my-5 border-t border-black/10" />

                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      E-mail
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <a
                        className="text-sm text-slate-900 hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.central}`}
                      >
                        {COMPANY.emails.central}
                      </a>
                      <a
                        className="text-sm text-slate-900 hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.procurement}`}
                      >
                        {COMPANY.emails.procurement}
                      </a>
                    </div>

                    <hr className="my-5 border-t border-black/10" />

                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Nyitvatartás
                    </div>
                    <ul className="mt-2 grid gap-1.5 text-sm">
                      <li className="flex items-center justify-between">
                        <span className="text-black/70">Hétfő–Péntek</span>
                        <span className="font-semibold text-slate-900">
                          {COMPANY.hours.weekdays.opens}–
                          {COMPANY.hours.weekdays.closes}
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-black/70">Szombat</span>
                        <span className="font-semibold text-slate-900">
                          {COMPANY.hours.saturday.opens}–
                          {COMPANY.hours.saturday.closes}
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-black/70">Vasárnap</span>
                        <span className="font-semibold text-slate-900">
                          zárva
                        </span>
                      </li>
                    </ul>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <a
                        href={googleMapsDirectionsUrl()}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
                      >
                        Útvonal
                      </a>
                      <Link
                        href="/kapcsolat"
                        className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      >
                        Üzenet írása →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Right: map embed */}
                <div className="md:col-span-7">
                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <iframe
                      title="Hírös-Ablak, Google Maps"
                      src={mapEmbed}
                      className="block h-full w-full"
                      style={{ border: 0, minHeight: 520 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────── 07B — VÉLEMÉNYEK (Trustindex) ──────────────────── */}
        <section
          aria-label="Vélemények"
          className="bg-white py-14 md:py-20 border-y border-black/10"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-2xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  Vélemények
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Amit a vásárlóink mondanak
                </h2>
                <div
                  aria-hidden
                  className="mx-auto mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <TrustindexWidget widgetId={TRUSTINDEX_WIDGET_ID} />
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────────────── 08 — FAQ ───────────────────────────────── */}
        <section
          aria-label="Gyakori kérdések"
          className="bg-stone-wash py-14 md:py-20"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-2xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  Tudnivalók
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Gyakori kérdések
                </h2>
                <div
                  aria-hidden
                  className="mx-auto mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
                <p className="mt-4 text-base text-black/70">
                  Ha valamire nem kapott választ, hívjon.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <FaqAccordion items={[...HOME_FAQ]} />
            </RevealOnScroll>
          </div>
        </section>

        {/* ─────────────────── 09 — FINAL CTA (slate-900) ─────────────────── */}
        <section
          aria-label="Indítsa el a projektjét"
          className="relative isolate overflow-hidden bg-slate-900 py-16 md:py-24"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 -z-0 h-[460px] w-[860px] -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.32) 0%, transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 -z-0 h-[360px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.18) 0%, transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 -z-0 h-[360px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <RevealOnScroll>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
                Kezdje el most
              </h2>
              <div
                aria-hidden
                className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
              />
              <p className="mx-auto mt-5 max-w-2xl text-base md:text-lg text-white/80">
                Online ajánlat 2 perc alatt. Telefonon munkanapokon válaszolunk.
                Vagy jöjjön be Kecskemétre, ahogy Önnek a legkényelmesebb.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={LINKS.onlineOrdering}
                  target="_blank"
                  rel="noreferrer"
                  className={ctaPrimaryDark}
                >
                  Online árajánlat
                </a>
                <a
                  href={`tel:${COMPANY.phones.primary}`}
                  className={ctaSecondaryDark}
                >
                  Hívás: {phoneDisplay}
                </a>
                <a
                  href={googleMapsDirectionsUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-6 py-3 text-base font-semibold text-white/85 hover:text-white hover:border-white/40 transition"
                >
                  Útvonal
                </a>
              </div>

              <p className="mt-5 text-xs text-white/55">
                Az online árajánlat ingyenes és nem kötelezi semmire.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/55">
                <span>1996 óta Kecskeméten</span>
                <span aria-hidden>·</span>
                <span>Magyar tulajdon · Saját üzem</span>
                <span aria-hidden>·</span>
                <a
                  href={VASALATMESTER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white underline underline-offset-4"
                >
                  Vasalatmester.hu webáruház ↗
                </a>
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </RevealOnLoad>
    </div>
  )
}
