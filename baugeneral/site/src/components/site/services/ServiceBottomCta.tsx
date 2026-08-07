import Link from "next/link"
import type { ServiceDefinition } from "@/lib/services"

type ServiceBottomCtaProps = {
  service: ServiceDefinition
}

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://")
}

export function ServiceBottomCta({ service }: ServiceBottomCtaProps) {
  const { headings, relatedLinks, ctaImage, ctaImageAlt } = service

  return (
    <section
      aria-labelledby="service-cta-heading"
      className="mx-auto max-w-6xl px-4 pt-10"
    >
      {relatedLinks.length > 0 ? (
        <nav aria-label="Kapcsolódó oldalak" className="mb-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {relatedLinks.map((link) => {
              const external = isExternalHref(link.href)
              const className =
                "text-base font-medium text-[var(--foreground)]/70 transition-colors hover:text-[var(--color-brand)]"
              return (
                <li key={link.href}>
                  {external ? (
                    <a
                      href={link.href}
                      className={className}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label} →
                    </a>
                  ) : (
                    <Link href={link.href} className={className}>
                      {link.label} →
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-[var(--color-surface-soft)] shadow-[var(--shadow-soft)] md:grid-cols-5">
        <div className="flex flex-col justify-center px-5 py-7 md:col-span-3 md:px-8 md:py-9">
          <h2 id="service-cta-heading" className="service-h2">
            {headings.ctaTitle}
          </h2>
          <p className="service-body mt-3">{headings.ctaBody}</p>
          <div className="mt-6">
            <Link
              href="/kapcsolat"
              className="btn-primary inline-flex px-5 py-2.5 text-base font-semibold"
            >
              Kapcsolatfelvétel
            </Link>
          </div>
        </div>

        <div className="relative min-h-[180px] md:col-span-2 md:min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ctaImage}
            alt={ctaImageAlt}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
      </div>
    </section>
  )
}
