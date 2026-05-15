import Link from "next/link"
import Image from "next/image"
import {
  COMPANY,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
} from "@/lib/company"
import { CookieSettingsLink } from "./CookieBanner"
import { OpeningHoursPill } from "./OpeningHoursPill"
import {
  FOOTER_PARTNERS,
  FOOTER_PRODUCTS,
  FOOTER_SERVICES,
  FOOTER_SHOWCASE,
  LEGAL_LINKS,
  MAJOR_BRANDS,
  PAYMENT_METHODS,
  SERVICE_AREAS,
  STOREFRONT_PHOTO,
  TRUST_STATS,
  TURINOVA_HOME_URL,
  TURINOVA_REGISTER_URL,
  type FooterLink,
} from "@/lib/footer-data"

/**
 * Footer column with a built-in mobile accordion behaviour.
 *
 * A single <details> serves both viewports:
 *   - mobile: native collapse / expand
 *   - md+: forced-open via the .footer-collapse CSS in globals.css
 */
function FooterColumn({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <details
      open
      className="footer-collapse group border-b border-black/10 last:border-b-0 md:border-none"
    >
      <summary className="flex list-none cursor-pointer items-center justify-between py-3 text-[11px] font-semibold uppercase tracking-wide text-black/55 md:py-0">
        <span>{title}</span>
        <span
          aria-hidden
          className="text-sm text-black/40 transition-transform group-open:rotate-180 md:hidden"
        >
          ▾
        </span>
      </summary>
      <div className="footer-collapse-content pb-4 md:mt-4 md:pb-0">
        {children}
      </div>
    </details>
  )
}

function LinkList({ items }: { items: readonly FooterLink[] }) {
  return (
    <ul className="grid gap-2 text-sm text-black/75">
      {items.map((item) => (
        <li key={`${item.href}-${item.label}`}>
          {item.external ? (
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--color-brand)] hover:underline underline-offset-4"
            >
              {item.label}
              <span aria-hidden className="text-black/35">
                ↗
              </span>
            </a>
          ) : (
            <Link
              href={item.href}
              className="hover:text-[var(--color-brand)] hover:underline underline-offset-4"
            >
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-black/45"
      aria-hidden
    >
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-black/45"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-black/45"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer role="contentinfo" className="bg-white">
      {/* ───────────────────────── TIER 1: Final CTA ───────────────────────── */}
      <section
        aria-label="Lépjen kapcsolatba"
        className="relative isolate overflow-hidden border-t border-[var(--color-brand)]/15"
      >
        {/* Vibrant layered background:
              base brand-tinted wash + soft radial glow + thin top accent line */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--color-brand)_10%,#fafaf9)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 400px at 12% 0%, color-mix(in srgb, var(--color-brand) 14%, transparent), transparent 70%), radial-gradient(700px 400px at 95% 100%, color-mix(in srgb, var(--color-brand) 8%, transparent), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)]/60 to-transparent"
        />

        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-9 md:flex-row md:items-center md:justify-between md:py-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand)] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              {COMPANY.address.city} · 1996 óta
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-black/90 md:text-2xl">
              Lépjen velünk kapcsolatba
            </div>
            <p className="mt-1 max-w-md text-sm text-black/70">
              Helyben Kecskeméten, telefonon vagy online. Válaszolunk
              munkanapokon, üzletünkben szombaton is.
            </p>
            <div className="mt-3">
              <OpeningHoursPill />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={googleMapsDirectionsUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/95 px-4 py-2.5 text-sm font-semibold text-black/80 backdrop-blur-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              <PinIcon />
              Útvonaltervezés
            </a>
            <a
              href={`tel:${COMPANY.phones.primary}`}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/95 px-4 py-2.5 text-sm font-semibold text-black/80 backdrop-blur-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              <PhoneIcon />
              Hívás
            </a>
            <a
              href={TURINOVA_REGISTER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--color-brand-contrast)] shadow-[0_8px_22px_rgba(151,29,37,0.32)] hover:brightness-95"
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
                <path d="M3 7h18l-1.5 12.5a2 2 0 0 1-2 1.5h-11a2 2 0 0 1-2-1.5L3 7Z" />
                <path d="M8 7V5a4 4 0 0 1 8 0v2" />
                <path d="m9 14 2 2 4-4" />
              </svg>
              Online árajánlat
            </a>
          </div>
        </div>
      </section>

      {/* ─────────────────────── TIER 1.5: Visual Showcase ─────────────────── */}
      <section
        aria-label="Hírös-Ablak bemutatkozó képek"
        className="border-t border-black/5 bg-white"
      >
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {FOOTER_SHOWCASE.map((card) => (
              <li key={card.label}>
                <Link
                  href={card.href}
                  className="group block overflow-hidden rounded-xl border border-black/10 bg-white transition hover:border-[var(--color-brand)]/40 hover:shadow-[0_10px_30px_rgba(151,29,37,0.12)]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                    <Image
                      src={card.image}
                      alt={card.alt}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 280px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                    />
                    <div className="absolute left-3 right-3 bottom-2.5 text-white">
                      <div className="text-[11px] uppercase tracking-wide text-white/75">
                        {card.caption}
                      </div>
                      <div className="text-sm font-semibold leading-snug md:text-base">
                        {card.label}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────────────────── TIER 2: Mega Footer ────────────────────── */}
      <section
        aria-label="Lábléc információk"
        className="border-t border-black/5"
      >
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="grid gap-x-10 gap-y-2 md:grid-cols-12 md:gap-y-10">
            {/* COL 1 — Company NAP + heritage */}
            <div className="md:col-span-12 lg:col-span-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/img/hiros_logo.png"
                  alt="Hírös-Ablak Kft. logo"
                  width={148}
                  height={44}
                  className="h-auto w-[140px]"
                />
              </div>
              <div className="mt-4 text-sm text-black/75">
                <div className="font-semibold text-black/90">
                  {COMPANY.shortName}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-black/45">
                  1996 óta · Magyar tulajdon · Saját üzem
                </div>
                <p className="mt-3 text-sm text-black/70">
                  1996 óta lapszabászat, élzárás és bútorlap{" "}
                  {COMPANY.address.city}en. Magánszemélyeknek, asztalosoknak,
                  gyárnak egyaránt.
                </p>

                <ul className="mt-4 grid gap-2.5">
                  <li className="flex items-start gap-2">
                    <PinIcon />
                    <a
                      href={googleMapsDirectionsUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[var(--color-brand)]"
                    >
                      {COMPANY.address.full}
                    </a>
                  </li>
                  <li className="flex items-start gap-2">
                    <PhoneIcon />
                    <span className="grid">
                      <a
                        className="hover:text-[var(--color-brand)]"
                        href={`tel:${COMPANY.phones.primary}`}
                      >
                        {formatPhoneDisplay(COMPANY.phones.primary)}
                        <span className="ml-1.5 text-xs text-black/45">
                          központ
                        </span>
                      </a>
                      <a
                        className="hover:text-[var(--color-brand)]"
                        href={`tel:${COMPANY.phones.secondary}`}
                      >
                        {formatPhoneDisplay(COMPANY.phones.secondary)}
                        <span className="ml-1.5 text-xs text-black/45">
                          másik vonal
                        </span>
                      </a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MailIcon />
                    <span className="grid">
                      <a
                        className="hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.central}`}
                      >
                        {COMPANY.emails.central}
                        <span className="ml-1.5 text-xs text-black/45">
                          általános
                        </span>
                      </a>
                      <a
                        className="hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.procurement}`}
                      >
                        {COMPANY.emails.procurement}
                        <span className="ml-1.5 text-xs text-black/45">
                          áruház, beszerzés
                        </span>
                      </a>
                      <a
                        className="hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.finance}`}
                      >
                        {COMPANY.emails.finance}
                        <span className="ml-1.5 text-xs text-black/45">
                          számlázás
                        </span>
                      </a>
                    </span>
                  </li>
                </ul>

                {/* Storefront thumbnail (placeholder photo, swap later) */}
                <Link
                  href="/kapcsolat"
                  className="group mt-5 block overflow-hidden rounded-xl border border-black/10 transition hover:border-[var(--color-brand)]/40 hover:shadow-[0_8px_24px_rgba(151,29,37,0.12)]"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100">
                    <Image
                      src={STOREFRONT_PHOTO.src}
                      alt={STOREFRONT_PHOTO.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 380px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/15 to-transparent"
                    />
                    <div className="absolute left-3 right-3 bottom-2.5 flex items-end justify-between gap-2 text-white">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-white/75">
                          Üzletünk
                        </div>
                        <div className="text-sm font-semibold leading-snug">
                          Mindszenti krt. 10.
                        </div>
                      </div>
                      <span
                        aria-hidden
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[var(--color-brand)] shadow-md transition group-hover:bg-[var(--color-brand)] group-hover:text-white"
                      >
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* COLS 2-5 — sitemap */}
            <nav
              aria-label="Lábléc oldaltérkép"
              className="md:col-span-12 lg:col-span-8"
            >
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-4">
                <FooterColumn title="Szolgáltatások">
                  <LinkList items={FOOTER_SERVICES} />
                </FooterColumn>

                <FooterColumn title="Termékek">
                  <LinkList items={FOOTER_PRODUCTS} />
                </FooterColumn>

                <FooterColumn title="Partnereknek">
                  <LinkList items={FOOTER_PARTNERS} />
                </FooterColumn>

                <FooterColumn title="Kiszolgálási terület">
                  <div className="grid gap-4 text-sm text-black/70">
                    {SERVICE_AREAS.map((group) => (
                      <div key={group.label}>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-black/45">
                          {group.label}
                        </div>
                        <ul className="mt-1.5 grid gap-1">
                          {group.cities.map((city) => (
                            <li key={city}>{city}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <p className="text-xs text-black/50">
                      Kecskeméten személyes átvétel, bemutatóterem és üzem egy helyen.
                    </p>
                  </div>
                </FooterColumn>
              </div>
            </nav>
          </div>
        </div>
      </section>

      {/* ───────────────────────── TIER 3: Brand Carpet ───────────────────── */}
      <section
        aria-label="Forgalmazott márkák"
        className="relative isolate overflow-hidden border-t border-black/5"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-stone-100/70 to-stone-50/40"
        />
        <div className="mx-auto max-w-6xl px-4 py-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
            <div className="md:w-44 md:shrink-0 md:pt-1.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black/55">
                <span
                  aria-hidden
                  className="inline-block h-2 w-6 rounded-full bg-[var(--color-brand)]/80"
                />
                Forgalmazott márkák
              </div>
              <p className="mt-1 hidden text-xs text-black/55 md:block">
                Vezető hazai és nemzetközi gyártók kínálatából
                válogathat.
              </p>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {MAJOR_BRANDS.map((brand) => (
                <li key={brand.name}>
                  <Link
                    href={brand.href}
                    className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/80 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-[var(--color-brand-contrast)] hover:shadow-[0_6px_14px_rgba(151,29,37,0.25)]"
                  >
                    {brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────── TIER 4: Trust + Payment ────────────────── */}
      <section
        aria-label="Bizalmi mutatók és fizetési módok"
        className="border-t border-black/5 bg-white"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 md:flex-row md:items-center md:justify-between">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-8">
            {TRUST_STATS.map((s) => (
              <li
                key={s.label}
                className="flex items-baseline gap-2 border-l border-[var(--color-brand)]/30 pl-3"
              >
                <span className="text-lg font-bold tabular-nums text-[var(--color-brand)] md:text-xl">
                  {s.number}
                </span>
                <span className="text-xs text-black/60">{s.label}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-black/45">
              Fizetési módok
            </span>
            {PAYMENT_METHODS.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center rounded-md border border-[var(--color-brand)]/20 bg-[color-mix(in_srgb,var(--color-brand)_4%,white)] px-2.5 py-1 text-xs font-medium text-black/75"
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── TIER 5: Legal Strip ────────────────────── */}
      <section
        aria-label="Jogi információk"
        className="border-t border-black/10 bg-stone-100/70"
      >
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col gap-3 text-xs text-black/55 md:flex-row md:items-center md:justify-between">
            <div>
              © {year} {COMPANY.shortName} · Adószám: {COMPANY.taxIdDisplay} ·
              Cégjegyzék: {COMPANY.companyRegistrationNumber} · EUTR:{" "}
              {COMPANY.eutr} · TEÁOR {COMPANY.mainActivity.code}
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="hover:text-[var(--color-brand)] hover:underline underline-offset-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsLink className="hover:text-[var(--color-brand)] hover:underline underline-offset-4">
                  Süti beállítások
                </CookieSettingsLink>
              </li>
            </ul>
          </div>
          <div className="mt-3 text-center text-[11px] text-black/40">
            Az oldalt a{" "}
            <a
              href={TURINOVA_HOME_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-[var(--color-brand)]"
            >
              Turinova
            </a>{" "}
            rendszer üzemelteti.
          </div>
        </div>
      </section>
    </footer>
  )
}
