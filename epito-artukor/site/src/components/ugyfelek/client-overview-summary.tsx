"use client"

import type { ClientStats } from "@/lib/client-queries"

type ClientOverviewSummaryProps = {
  stats: ClientStats
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-center sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  )
}

export function ClientOverviewSummary({ stats }: ClientOverviewSummaryProps) {
  const hasActivity = stats.projectCount > 0 || stats.quoteCount > 0

  return (
    <section className="px-5 py-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Elfogadott ajánlatok összege
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 sm:text-3xl">
            {stats.acceptedGrossFormatted}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {stats.projectCount > 0
              ? `${stats.activeProjectCount} aktív projekt · ${stats.projectCount} összesen`
              : "Még nincs projekt ehhez az ügyfélhez"}
          </p>
        </div>

        {hasActivity ? (
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <Metric label="Projektek" value={String(stats.projectCount)} />
            <Metric label="Árajánlatok" value={String(stats.quoteCount)} />
            <Metric label="Nyitott" value={String(stats.openQuoteCount)} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Hozz létre projektet az Árajánlatok oldalon, vagy a Projektek fülön.
          </p>
        )}
      </div>
    </section>
  )
}
