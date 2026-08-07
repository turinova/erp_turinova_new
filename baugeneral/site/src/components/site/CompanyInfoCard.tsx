import { COMPANY, getImpressumRows } from "@/lib/company"

export function CompanyInfoCard() {
  const rows = getImpressumRows()

  return (
    <section
      aria-labelledby="cegadatok-heading"
      className="card-soft p-6 md:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cegadatok-heading" className="text-lg font-semibold text-black/90">
          Cégadatok
        </h2>
        <span className="text-xs text-black/55">Impresszum</span>
      </div>

      <dl className="mt-4 divide-y divide-black/5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-x-5"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-black/55 sm:pt-0.5">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-black/85 break-words">
              {row.label === "Honlap" ? (
                <a
                  className="underline underline-offset-4 hover:text-[var(--color-brand)]"
                  href={COMPANY.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.value}
                </a>
              ) : row.label === "E-mail" ? (
                <a
                  className="underline underline-offset-4 hover:text-[var(--color-brand)]"
                  href={`mailto:${row.value}`}
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
