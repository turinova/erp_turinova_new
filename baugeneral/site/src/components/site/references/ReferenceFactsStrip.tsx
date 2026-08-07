import type { ReferenceFactRow } from "@/lib/references"

export function ReferenceFactsStrip({ facts }: { facts: ReferenceFactRow[] }) {
  return (
    <section aria-label="Projekt adatok" className="border-y border-black/8 bg-white">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-y-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-black/45">
              {fact.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium leading-snug text-black/85">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
