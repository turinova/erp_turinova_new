"use client"

import type { SubcontractorStats } from "@/lib/subcontractor-queries"

type SubcontractorOverviewSummaryProps = {
  stats: SubcontractorStats
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-center sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  )
}

export function SubcontractorOverviewSummary({ stats }: SubcontractorOverviewSummaryProps) {
  const hasActivity =
    stats.invitationCount > 0 ||
    stats.submittedCount > 0 ||
    stats.acceptedCount > 0 ||
    stats.rejectedCount > 0

  const heroValue = stats.lastSubmissionAt
    ? new Date(stats.lastSubmissionAt).toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—"

  return (
    <section className="px-5 py-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Utolsó beküldött ajánlat
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 sm:text-3xl">
            {heroValue}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {stats.lastSubmissionAt
              ? `${stats.submittedCount} beküldött ajánlat összesen`
              : "Még nem küldött be ajánlatot"}
          </p>
        </div>

        {hasActivity ? (
          <div className="grid grid-cols-4 gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <Metric label="Meghívás" value={String(stats.invitationCount)} />
            <Metric label="Beküldött" value={String(stats.submittedCount)} />
            <Metric label="Elfogadott" value={String(stats.acceptedCount)} />
            <Metric label="Elutasított" value={String(stats.rejectedCount)} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Még nincs RFQ tevékenység — meghívás a projekt Alvállalkozók fülén.
          </p>
        )}
      </div>
    </section>
  )
}
