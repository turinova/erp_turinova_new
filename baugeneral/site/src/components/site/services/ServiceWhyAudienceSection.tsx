import type { ServiceDefinition } from "@/lib/services"

type ServiceWhyAudienceSectionProps = {
  service: ServiceDefinition
}

export function ServiceWhyAudienceSection({ service }: ServiceWhyAudienceSectionProps) {
  const { headings, whyParagraphs, audience } = service

  return (
    <section aria-labelledby="service-why-heading" className="mx-auto max-w-6xl px-4">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="header-brand-strip mb-5 w-16" aria-hidden />
          <h2 id="service-why-heading" className="service-h2">
            {headings.why}
          </h2>
          <div className="mt-5 space-y-4">
            {whyParagraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="service-body text-pretty">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            {headings.audience}
          </h3>
          <ul className="mt-5 space-y-4">
            {audience.map((item) => (
              <li
                key={item.title}
                className="border-b border-black/10 pb-4 last:border-b-0 last:pb-0"
              >
                <h4 className="text-lg font-semibold text-[var(--foreground)]">
                  {item.title}
                </h4>
                <p className="service-body mt-2">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
