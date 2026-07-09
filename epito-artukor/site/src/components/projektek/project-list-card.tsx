"use client"

import Link from "next/link"
import {
  ArrowRight,
  FileText,
  FolderKanban,
  Plus,
} from "lucide-react"
import type { Project } from "@/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import type { ProjectListSummary } from "@/lib/project-list-summary"
import { formatHuf } from "@/lib/pricing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectListPhase } from "@/lib/project-phase"
import { PROJECT_PHASE_LABELS } from "@/lib/project-phase"

const statusVariant: Record<
  Project["status"],
  "default" | "secondary" | "success" | "warning" | "outline"
> = {
  prospect: "outline",
  quoting: "warning",
  won: "success",
  in_progress: "default",
  done: "secondary",
  archived: "secondary",
}

type ProjectListCardProps = {
  project: Project
  summary: ProjectListSummary
}

export function ProjectListCard({ project, summary }: ProjectListCardProps) {
  const isArchived = project.status === "archived"
  const hasQuotes = summary.quoteCount > 0

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md",
        isArchived && "opacity-75"
      )}
    >
      <Link href={`/projektek/${project.id}`} className="block p-4 hover:bg-slate-50/50">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-code text-xs font-medium text-blue-700">{project.code}</span>
              <Badge variant={statusVariant[project.status]} className="text-xs font-normal">
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold leading-snug text-slate-900">{project.name}</h2>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
              {project.clientName || "—"}
            </p>
            {project.siteAddress ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">{project.siteAddress}</p>
            ) : null}
          </div>
          <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-300" />
        </div>

        {hasQuotes ? (
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-blue-100 bg-blue-50/80 px-3 py-2">
              <p className="text-xs text-blue-800">
                {summary.isExecutionList ? "Szerződés" : "Ügyfél ára"}
              </p>
              <p className="ea-kpi-value text-base font-semibold tabular-nums text-blue-950">
                {formatHuf(summary.sellTotal)}
                {summary.isPartialTotal && !summary.isExecutionList ? (
                  <span className="ml-1 text-xs font-normal text-amber-700">(részleges)</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs text-slate-500">
                {summary.isExecutionList ? "TIG-elt" : "Fedezet"}
              </p>
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {summary.isExecutionList
                  ? summary.tigPercent != null
                    ? `${summary.tigPercent}%`
                    : "—"
                  : summary.marginPercent != null
                    ? `${summary.marginPercent}%`
                    : "—"}
              </p>
            </div>
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs text-slate-500">
                {summary.isExecutionList ? "Készültség" : "Árazás"}
              </p>
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {summary.pricedPercent}%
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-md border border-dashed bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            Még nincs árajánlat
          </div>
        )}

        {hasQuotes ? (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{summary.isExecutionList ? "Készültség" : "Haladás"}</span>
              <span className="tabular-nums">{summary.pricedPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  summary.pricedPercent >= 100
                    ? "bg-emerald-500"
                    : summary.pricedPercent >= 50
                      ? "bg-blue-500"
                      : "bg-amber-400"
                )}
                style={{ width: `${summary.pricedPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        {summary.lastActivityLabel ? (
          <p className="mt-2 text-xs text-slate-400">{summary.lastActivityLabel}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            Frissítve: {new Date(summary.lastUpdatedAt).toLocaleDateString("hu-HU")}
          </p>
        )}

        {summary.activeQuoteTitle && summary.quoteCount > 1 ? (
          <p className="mt-1 text-xs text-slate-500">
            Aktív ajánlat: {summary.activeQuoteTitle}
          </p>
        ) : null}
      </Link>

      {!isArchived ? (
        <div className="flex flex-wrap gap-2 border-t bg-slate-50/80 px-4 py-3">
          {summary.activeQuoteId ? (
            <Button size="sm" asChild>
              <Link href={`/projektek/${project.id}/ajanlat/${summary.activeQuoteId}`}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Szerkesztés
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href={`/projektek/${project.id}?tab=quotes`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Árajánlat
              </Link>
            </Button>
          )}
          {summary.activeQuoteId &&
          summary.activeSummary &&
          summary.activeSummary.unpricedNotRfqCount > 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link
                href={`/projektek/${project.id}?tab=rfq&quote=${summary.activeQuoteId}&openRfq=1`}
              >
                RFQ küldés
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" asChild className="ml-auto">
            <Link href={`/projektek/${project.id}`}>Részletek</Link>
          </Button>
        </div>
      ) : null}
    </article>
  )
}

export function ProjectsEmptyState({
  onCreate,
  phase = "quotes",
}: {
  onCreate?: () => void
  phase?: ProjectListPhase
}) {
  const emptyCopy: Record<ProjectListPhase, string> = {
    quotes:
      "Hozz létre egy projektet az ügyfélhez — innen kezelheted az árajánlatokat és az alvállalkozói bekéréseket.",
    execution:
      "Még nincs elfogadott munka. Ha az ügyfél elfogad egy ajánlatot, a projekt automatikusan ide kerül.",
    archive: "Nincs lezárt vagy archivált projekt.",
  }

  return (
    <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <FolderKanban className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        Nincs {PROJECT_PHASE_LABELS[phase].toLowerCase()}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{emptyCopy[phase]}</p>
      {onCreate ? (
        <Button className="mt-6" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Új projekt
        </Button>
      ) : null}
    </div>
  )
}
