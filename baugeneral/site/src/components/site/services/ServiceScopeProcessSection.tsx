import type { ServiceDefinition } from "@/lib/services"

type ServiceScopeProcessSectionProps = {
  service: ServiceDefinition
}

export function ServiceScopeProcessSection({ service }: ServiceScopeProcessSectionProps) {
  const { headings, scopeItems, scopeExcluded, processSteps } = service
  const singleColumn = service.layoutVariant === "compactSingleCol"

  return (
    <section className="mx-auto max-w-6xl px-4">
      <div
        className={[
          "grid gap-12",
          singleColumn ? "max-w-3xl" : "lg:grid-cols-2 lg:gap-16",
        ].join(" ")}
      >
        <div aria-labelledby="service-scope-heading">
          <h2 id="service-scope-heading" className="service-h2">
            {headings.scope}
          </h2>
          <ol className="mt-6 space-y-3">
            {scopeItems.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="w-7 shrink-0 font-mono text-sm font-semibold tabular-nums text-black/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="service-body">{item}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-[var(--radius-md)] border border-black/10 bg-[var(--color-surface-soft)] px-4 py-4">
            <p className="service-meta">{headings.scopeExcludedTitle}</p>
            <p className="service-body mt-2">{scopeExcluded}</p>
          </div>
        </div>

        <div aria-labelledby="service-process-heading">
          <h2 id="service-process-heading" className="service-h2">
            {headings.process}
          </h2>
          <ol className="mt-6 space-y-4">
            {processSteps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="w-7 shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--color-brand)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {step.title}
                  </h3>
                  <p className="service-body mt-1">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
