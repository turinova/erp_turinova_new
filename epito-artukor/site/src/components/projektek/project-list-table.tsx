"use client"

import { useRouter } from "next/navigation"
import type { Project } from "@/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import type { ProjectListSummary } from "@/lib/project-list-summary"
import { formatHuf } from "@/lib/pricing"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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

export type ProjectListTableRow = {
  project: Project
  summary: ProjectListSummary
}

type ProjectListTableProps = {
  rows: ProjectListTableRow[]
}

function ReadinessBar({ percent }: { percent: number }) {
  const tone =
    percent >= 100 ? "bg-emerald-500" : percent >= 50 ? "bg-blue-500" : "bg-amber-400"
  return (
    <div className="flex min-w-[5rem] flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-right text-xs font-semibold tabular-nums text-slate-700">
        {percent}%
      </span>
    </div>
  )
}

export function ProjectListTable({ rows }: ProjectListTableProps) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead className="ea-table-head text-xs">
            <tr>
              <th className="px-3 py-2.5 text-left">Projekt</th>
              <th className="px-3 py-2.5 text-left">Ügyfél</th>
              <th className="hidden px-3 py-2.5 text-left lg:table-cell">Helyszín</th>
              <th className="px-3 py-2.5 text-left">Státusz</th>
              <th className="px-3 py-2.5 text-right">Bruttó</th>
              <th className="px-3 py-2.5 text-right">TIG / fedezet</th>
              <th className="px-3 py-2.5 text-right">Készültség</th>
              <th className="hidden px-3 py-2.5 text-left xl:table-cell">Utolsó tevékenység</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, summary }) => {
              const hasQuotes = summary.quoteCount > 0
              return (
                <tr
                  key={project.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/projektek/${project.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/projektek/${project.id}`)
                    }
                  }}
                  className={cn(
                    "cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50",
                    project.status === "archived" && "opacity-75"
                  )}
                >
                  <td className="px-3 py-3 align-middle">
                    <div className="min-w-[10rem]">
                      <span className="font-code text-xs font-medium text-blue-700">
                        {project.code}
                      </span>
                      <p className="mt-0.5 font-semibold leading-snug text-slate-900">
                        {project.name}
                      </p>
                      {summary.quoteCount > 0 ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {summary.quoteCount} szakág
                          {summary.activeQuoteTitle && summary.quoteCount === 1
                            ? ` · ${summary.activeQuoteTitle}`
                            : null}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-400">Nincs költségvetés</p>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[10rem] px-3 py-3 align-middle">
                    <p className="truncate font-medium text-slate-800">
                      {project.clientName || "—"}
                    </p>
                  </td>
                  <td className="hidden max-w-[12rem] px-3 py-3 align-middle lg:table-cell">
                    <p className="truncate text-slate-600">{project.siteAddress || "—"}</p>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <Badge variant={statusVariant[project.status]} className="text-xs font-normal">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    {hasQuotes ? (
                      <span className="font-semibold text-slate-900">
                        {formatHuf(summary.sellTotal)}
                        {summary.isPartialTotal ? (
                          <span className="ml-1 text-xs font-normal text-amber-700">~</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    {summary.isExecutionList ? (
                      summary.tigPercent != null ? (
                        <span className="font-semibold text-slate-900" title="TIG-elt">
                          TIG {summary.tigPercent}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )
                    ) : summary.marginPercent != null ? (
                      <span className="font-semibold text-slate-900">{summary.marginPercent}%</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {hasQuotes ? (
                      <ReadinessBar percent={summary.pricedPercent} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="hidden max-w-[14rem] px-3 py-3 align-middle xl:table-cell">
                    <p className="truncate text-xs text-slate-500">
                      {summary.lastActivityLabel ??
                        `Frissítve: ${new Date(summary.lastUpdatedAt).toLocaleDateString("hu-HU")}`}
                    </p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
