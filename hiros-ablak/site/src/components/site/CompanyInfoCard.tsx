import { COMPANY } from "@/lib/company"

type Row = { label: string; value: React.ReactNode; testId?: string }

export function CompanyInfoCard() {
  const rows: Row[] = [
    { label: "Cégnév", value: COMPANY.legalName },
    { label: "Rövid név", value: COMPANY.shortName },
    { label: "Adószám", value: COMPANY.taxId },
    { label: "Cégjegyzékszám", value: COMPANY.companyRegistrationNumber },
    {
      label: "Fő tevékenység",
      value: `${COMPANY.mainActivity.name} (TEÁOR ${COMPANY.mainActivity.code})`,
    },
    { label: "Cím", value: COMPANY.address.full },
    {
      label: "Honlap",
      value: (
        <a
          className="underline underline-offset-4 hover:text-[var(--color-brand)]"
          href={COMPANY.website}
          target="_blank"
          rel="noreferrer"
        >
          {COMPANY.website.replace(/^https?:\/\//, "")}
        </a>
      ),
    },
    {
      label: "Alapítva",
      value: new Date(COMPANY.foundingDate).toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  ]

  return (
    <section
      aria-labelledby="cegadatok-heading"
      className="rounded-2xl border border-black/10 bg-white p-6 md:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cegadatok-heading" className="text-lg font-semibold">
          Cégadatok
        </h2>
        <span className="text-xs text-black/55">Impresszum</span>
      </div>

      <dl className="mt-4 divide-y divide-black/5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-x-5 sm:gap-y-0"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-black/55 sm:pt-0.5">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-black/85 break-words">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
