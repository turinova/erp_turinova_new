import Link from "next/link"
import type { ServiceDefinition } from "@/lib/services"
import { getServiceRoute } from "@/lib/services"

type ServiceHeroProps = {
  service: ServiceDefinition
}

export function ServiceHero({ service }: ServiceHeroProps) {
  const route = getServiceRoute(service)
  const reverseHero = service.layoutVariant === "reverseHero"

  return (
    <section aria-labelledby="service-hero-heading" className="mx-auto max-w-6xl px-4">
      <div className="grid gap-8 md:grid-cols-2 md:items-start md:gap-12">
        <div className={reverseHero ? "md:order-2" : undefined}>
          <div className="header-brand-strip mb-5 w-16" aria-hidden />

          <h1 id="service-hero-heading" className="about-h1 text-pretty">
            {route.title}
          </h1>

          <p className="service-lead mt-4 text-pretty">{service.hook}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/kapcsolat"
              className="btn-primary px-5 py-2.5 text-base font-semibold"
            >
              Beszéljünk a projektjéről
            </Link>
          </div>

          <p className="service-body mt-7 text-pretty">{service.tldr}</p>
        </div>

        {route.heroImage ? (
          <div
            className={[
              "overflow-hidden rounded-[var(--radius-lg)] border border-black/10 shadow-[var(--shadow-card)]",
              reverseHero ? "md:order-1" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="aspect-[4/3] w-full md:aspect-[5/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={route.heroImage}
                alt={route.heroImageAlt ?? route.title}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        ) : null}
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-px border border-black/10 bg-black/10 md:grid-cols-4">
        {service.takeaways.map((item) => (
          <div key={item.label} className="bg-[var(--color-surface-soft)] px-4 py-5 md:px-5">
            <dt className="service-meta">{item.label}</dt>
            <dd className="mt-2 text-base font-semibold leading-snug text-[var(--foreground)] md:text-lg">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
