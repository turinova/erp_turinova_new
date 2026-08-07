import Image from "next/image"
import Link from "next/link"
import { COMPANY, googleMapsDirectionsUrl } from "@/lib/company"
import { HEADER_CTA } from "@/lib/nav-data"
import {
  FOOTER_COMPANY,
  FOOTER_SERVICES,
  LEGAL_LINKS,
  TRUST_STATS,
} from "@/lib/footer-data"

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

function LinkList({ items }: { items: readonly { href: string; label: string }[] }) {
  return (
    <ul className="grid gap-2 text-sm text-black/75">
      {items.map((item) => (
        <li key={`${item.href}-${item.label}`}>
          <Link
            href={item.href}
            className="hover:text-[var(--color-brand)] hover:underline underline-offset-4"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer role="contentinfo" className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <section
        aria-label="Lépjen kapcsolatba"
        className="border-b border-[var(--color-border)] bg-[var(--color-brand-subtle)]"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-semibold tracking-tight text-black/90">
              {HEADER_CTA.label}
            </p>
            <p className="mt-2 max-w-md text-sm text-black/70">
              Írjon üzenetet. Válaszunkat e-mailben küldjük.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/kapcsolat"
              className="btn-primary inline-flex px-5 py-2.5 text-sm font-semibold"
            >
              Kapcsolat
            </Link>
            <a
              href={`mailto:${COMPANY.emails.central}`}
              className="btn-secondary inline-flex px-5 py-2.5 text-sm font-semibold"
            >
              {COMPANY.emails.central}
            </a>
          </div>
        </div>
      </section>

      <section aria-label="Lábléc információk" className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Image
              src="/img/logo.svg"
              alt={COMPANY.brand}
              width={160}
              height={50}
              className="h-10 w-auto"
            />
            <p className="mt-3 text-sm text-black/70">{COMPANY.entityDefinitionHu}</p>
            <ul className="mt-4 grid gap-2 text-sm text-black/75">
              <li>
                <a
                  href={googleMapsDirectionsUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--color-brand)]"
                >
                  {COMPANY.address.full}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${COMPANY.emails.central}`}
                  className="hover:text-[var(--color-brand)]"
                >
                  {COMPANY.emails.central}
                </a>
              </li>
            </ul>
          </div>

          <nav
            aria-label="Lábléc oldaltérkép"
            className="grid gap-8 sm:grid-cols-2 md:col-span-8 md:grid-cols-3"
          >
            <FooterColumn title="Szolgáltatások">
              <LinkList items={FOOTER_SERVICES} />
            </FooterColumn>
            <FooterColumn title="Cég">
              <LinkList items={FOOTER_COMPANY} />
            </FooterColumn>
            <FooterColumn title="Kiszolgálás">
              <ul className="grid gap-1 text-sm text-black/70">
                {COMPANY.serviceArea.map((area) => (
                  <li key={area}>
                    {area === "Pest megye" ? (
                      <Link
                        href="/generalkivitelezes-pest-megye"
                        className="transition-colors hover:text-[var(--color-brand)]"
                      >
                        {area}
                      </Link>
                    ) : (
                      area
                    )}
                  </li>
                ))}
              </ul>
            </FooterColumn>
          </nav>
        </div>
      </section>

      <section
        aria-label="Bizalmi mutatók"
        className="border-t border-[var(--color-border)] bg-[var(--color-background)]"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-6">
          {TRUST_STATS.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <span className="text-lg font-bold tabular-nums text-[var(--color-brand)]">
                {s.number}
              </span>
              <span className="text-xs text-black/60">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-label="Jogi információk"
        className="border-t border-[var(--color-border)] bg-[var(--color-brand-subtle)]"
      >
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col gap-3 text-xs text-black/55 md:flex-row md:items-center md:justify-between">
            <div>
              © {year} {COMPANY.shortName}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
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
            </ul>
          </div>
        </div>
      </section>
    </footer>
  )
}
