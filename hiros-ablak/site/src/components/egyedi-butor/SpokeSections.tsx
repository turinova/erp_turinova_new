import Image from "next/image"
import Link from "next/link"
import FaqAccordion from "@/components/site/FaqAccordion"
import SurveyRequestForm from "@/components/egyedi-butor/SurveyRequestForm"
import TelClickLink from "@/components/egyedi-butor/TelClickLink"
import {
  CANONICAL_PATH,
  FORM_TRUST,
  SPOKE_PAGES,
  type FaqEntry,
  type FurnitureCategory,
  type GalleryItem,
} from "@/lib/egyedi-butor-data"

/**
 * Az aloldalak szerkezeti elemei. A szöveg mindig az oldalon marad, ide csak
 * a keret kerül — így a három aloldal nem sablonszövegből áll.
 */

export const SPOKE_H2 =
  "text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
export const SPOKE_LEAD = "mt-4 text-base leading-relaxed text-black/70"
export const SPOKE_BODY = "mt-4 text-base leading-relaxed text-black/70"
export const SPOKE_LINK =
  "font-medium text-[var(--color-brand)] underline decoration-[var(--color-brand)]/30 underline-offset-4 hover:decoration-[var(--color-brand)]"

export function SpokeSection({
  id,
  tone = "white",
  width = "prose",
  /** Utolsó szekciónál helyet hagy a mobil lebegő sávnak. */
  last = false,
  children,
}: {
  id?: string
  tone?: "white" | "wash"
  width?: "prose" | "wide"
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 border-t border-black/8 ${
        tone === "wash" ? "bg-stone-wash" : "bg-white"
      }`}
    >
      <div
        className={`mx-auto px-4 py-14 sm:px-6 sm:py-16 ${
          width === "prose" ? "max-w-3xl" : "max-w-5xl"
        } ${last ? "pb-24 sm:pb-16" : ""}`}
      >
        {children}
      </div>
    </section>
  )
}

/** Számozás nélküli, konkrét állításokból álló lista. */
export function SpokePoints({
  items,
}: {
  items: readonly { title: string; text: string }[]
}) {
  return (
    <dl className="mt-8 grid gap-5">
      {items.map((item) => (
        <div
          key={item.title}
          className="border-l-2 border-[var(--color-brand)]/25 pl-4"
        >
          <dt className="text-base font-semibold tracking-tight text-slate-900">
            {item.title}
          </dt>
          <dd className="mt-1.5 text-[15px] leading-relaxed text-black/65">
            {item.text}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function SpokeHero({
  image,
  eyebrow,
  title,
  lead,
  chips,
  phoneDisplay,
  phoneTel,
}: {
  image: GalleryItem
  eyebrow: string
  title: string
  lead: string
  chips: readonly string[]
  phoneDisplay: string
  phoneTel: string
}) {
  return (
    <section className="relative isolate bg-slate-950">
      {/* dvh, nem vh: mobilon az URL-sáv mozgása ne tolja a layoutot. */}
      <div className="relative h-[min(62dvh,620px)] w-full">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Mobilon alulról sötétítünk, nagy képernyőn balról: így a bútor
            nem a szöveg mögé kerül. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/15 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/45 lg:to-transparent"
        />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:inset-y-0 lg:flex lg:items-center lg:p-12">
          <div className="mx-auto w-full max-w-5xl">
            <nav aria-label="Morzsamenü" className="text-xs text-white/60">
              <Link href={CANONICAL_PATH} className="hover:text-white">
                Egyedi bútorgyártás
              </Link>
              <span aria-hidden className="mx-1.5">
                /
              </span>
              <span className="text-white/80">{eyebrow}</span>
            </nav>

            <h1 className="mt-3 max-w-2xl text-[clamp(1.65rem,3.6vw,2.6rem)] font-semibold leading-[1.14] tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {lead}
            </p>

            <ul className="mt-5 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm"
                >
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <a
                href="#felmeres"
                className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-semibold text-[var(--color-brand-contrast)] shadow-[0_8px_28px_rgba(151,29,37,0.35)] transition hover:brightness-95"
              >
                Kérem a felmérést
              </a>
              <TelClickLink
                href={phoneTel}
                location="spoke_hero"
                phoneDisplay={phoneDisplay}
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {phoneDisplay}
              </TelClickLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function SpokeFaq({
  heading,
  intro,
  items,
}: {
  heading: string
  intro: string
  items: readonly FaqEntry[]
}) {
  return (
    <SpokeSection id="gyik" tone="wash">
      <h2 className={SPOKE_H2}>{heading}</h2>
      <p className={SPOKE_LEAD}>{intro}</p>
      <div className="mt-8">
        <FaqAccordion items={items.map((f) => ({ q: f.q, a: f.a }))} />
      </div>
    </SpokeSection>
  )
}

export function SpokeSurvey({
  heading,
  intro,
  category,
  email,
  phoneDisplay,
  phoneTel,
}: {
  heading: string
  intro: string
  category: FurnitureCategory
  email: string
  phoneDisplay: string
  phoneTel: string
}) {
  return (
    <SpokeSection id="felmeres">
      <h2 className={SPOKE_H2}>{heading}</h2>
      <p className={SPOKE_LEAD}>{intro}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {FORM_TRUST.map((item) => (
          <li
            key={item}
            className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-black/65"
          >
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] sm:p-7">
        <SurveyRequestForm
          phoneDisplay={phoneDisplay}
          phoneTel={phoneTel}
          email={email}
          defaultType={category}
          idPrefix={`spoke-${category}`}
        />
      </div>
    </SpokeSection>
  )
}

export function SpokeRelated({ current }: { current: FurnitureCategory }) {
  const others = SPOKE_PAGES.filter((s) => s.category !== current)

  return (
    <SpokeSection tone="wash" width="wide" last>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        Amit még gyártunk
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {others.map((spoke) => (
          <Link
            key={spoke.path}
            href={spoke.path}
            className="group rounded-2xl border border-black/10 bg-white p-5 transition hover:border-[var(--color-brand)]/40"
          >
            <h3 className="text-base font-semibold tracking-tight text-slate-900">
              {spoke.navLabel}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-black/60">
              {spoke.navSummary}
            </p>
          </Link>
        ))}
        <Link
          href={CANONICAL_PATH}
          className="group rounded-2xl border border-black/10 bg-white p-5 transition hover:border-[var(--color-brand)]/40"
        >
          <h3 className="text-base font-semibold tracking-tight text-slate-900">
            Minden munkánk egy helyen
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            A teljes fotógaléria, a folyamat és a gyakori kérdések.
          </p>
        </Link>
      </div>
    </SpokeSection>
  )
}
