import Link from 'next/link'

import { cn } from '@/lib/utils'

export function BacklogMetersCard({
  cuttingM,
  edgeM
}: {
  cuttingM: number
  edgeM: number
}) {
  const hot = cuttingM > 0 || edgeM > 0

  return (
    <section
      className={cn(
        'rounded-md border bg-surface p-4',
        hot ? 'border-danger/40' : 'border-border'
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-body font-semibold text-ink">
            Elmaradás (múlt napok)
          </h2>
          <p className="text-hint text-ink-secondary">
            Tegnap előtti gyártási dátumok. Kész / lezárva / törölve nem számít.
          </p>
        </div>
        <Link
          href="/megrendelesek?status=all"
          className="text-hint text-ink-secondary no-underline hover:underline"
        >
          Megrendelések →
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div
          className={cn(
            'rounded-md border px-3 py-3',
            cuttingM > 0
              ? 'border-danger/30 bg-danger-soft/40'
              : 'border-border bg-subtle'
          )}
        >
          <p className="text-hint text-ink-secondary">Szabás elmaradás</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {cuttingM.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m
          </p>
        </div>
        <div
          className={cn(
            'rounded-md border px-3 py-3',
            edgeM > 0
              ? 'border-danger/30 bg-danger-soft/40'
              : 'border-border bg-subtle'
          )}
        >
          <p className="text-hint text-ink-secondary">Élzárás elmaradás</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {edgeM.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m
          </p>
        </div>
      </div>
    </section>
  )
}
