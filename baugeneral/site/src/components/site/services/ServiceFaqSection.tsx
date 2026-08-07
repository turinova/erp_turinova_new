import type { ServiceFaqItem, ServiceSectionHeadings } from "@/lib/services"

type ServiceFaqSectionProps = {
  items: readonly ServiceFaqItem[]
  headings: Pick<ServiceSectionHeadings, "faq">
}

export function ServiceFaqSection({ items, headings }: ServiceFaqSectionProps) {
  return (
    <section aria-labelledby="service-faq-heading" className="mx-auto max-w-3xl px-4">
      <h2 id="service-faq-heading" className="service-h2">
        {headings.faq}
      </h2>

      <div className="mt-6 divide-y divide-black/10">
        {items.map((item) => (
          <details key={item.id} className="group py-4" open={item.defaultOpen}>
            <summary className="cursor-pointer list-none text-base font-semibold leading-snug text-[var(--foreground)] marker:content-none md:text-lg [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.q}
                <span
                  aria-hidden
                  className="shrink-0 text-black/40 transition group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="service-body mt-3 pr-6">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
