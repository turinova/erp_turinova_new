import type { ProjectFactRow } from "@/lib/projects"

export function ProjectFactsStrip({ facts }: { facts: ProjectFactRow[] }) {
  return (
    <section aria-label="Projekt adatok" className="border-y border-black/8 bg-white">
      <dl className="mx-auto grid max-w-6xl grid-cols-1 gap-x-6 gap-y-4 px-4 py-5 sm:grid-cols-2 lg:grid-cols-3 md:px-6 md:py-6">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-black/45">
              {fact.label}
            </dt>
            <dd className="mt-1 text-base font-medium leading-snug text-black/88 md:text-lg">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
