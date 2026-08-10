import { COMPANY, getImpressumRows } from "@/lib/company"

export function ContactImpressum() {
  const rows = getImpressumRows()

  return (
    <footer
      aria-labelledby="cegadatok-heading"
      className="border-t border-[var(--color-border)]/80 bg-[var(--color-surface-soft)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <h2
          id="cegadatok-heading"
          className="text-xs font-medium uppercase tracking-wide text-black/45"
        >
          Cégadatok
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-black/50">{row.label}</dt>
              <dd className="mt-0.5 font-medium text-black/82 break-words">
                {row.label === "Honlap" ? (
                  <a
                    href={COMPANY.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {row.value}
                  </a>
                ) : row.label === "E-mail" ? (
                  <a
                    href={`mailto:${row.value}`}
                    className="text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {row.value}
                  </a>
                ) : row.label === "Telefon" ? (
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="text-[var(--color-brand)] underline underline-offset-2"
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
      </div>
    </footer>
  )
}
