"use client"

import type { Client } from "@/types/clients"
import type { ClientStats } from "@/lib/client-queries"
import { ClientOverviewSummary } from "@/components/ugyfelek/client-overview-summary"
import { ClientQuickContact } from "@/components/ugyfelek/client-quick-contact"
import { ClientProjectsPreview } from "@/components/ugyfelek/client-projects-preview"
import { ClientQuotesPreview } from "@/components/ugyfelek/client-quotes-preview"

type ClientOverviewTabProps = {
  client: Client
  stats: ClientStats
  onViewAllProjects: () => void
}

export function ClientOverviewTab({ client, stats, onViewAllProjects }: ClientOverviewTabProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <ClientOverviewSummary stats={stats} />
      <ClientQuickContact client={client} />
      <ClientProjectsPreview client={client} onViewAll={onViewAllProjects} />
      <ClientQuotesPreview client={client} />
      {client.internalNotes ? (
        <section className="border-t border-slate-100 px-5 py-3.5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Belső megjegyzés
          </p>
          <p className="text-sm leading-relaxed text-slate-600">{client.internalNotes}</p>
        </section>
      ) : null}
    </div>
  )
}
