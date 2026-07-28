"use client"

import { useRouter } from "next/navigation"
import type { MouseEvent } from "react"
import { toast } from "sonner"
import type { Project } from "@/types/projects"
import type { ProjectListSummary } from "@/lib/project-list-summary"
import {
  executionStatusSentence,
  resolveExecutionNextStep,
} from "@/lib/execution-list-next-step"
import { updateProject } from "@/lib/data/projects-store"
import { formatHuf } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ExecutionProjectListRow = {
  project: Project
  summary: ProjectListSummary
}

type ExecutionProjectListTableProps = {
  rows: ExecutionProjectListRow[]
  onChanged?: () => void
}

function ReadinessBar({ percent }: { percent: number }) {
  const tone =
    percent >= 100 ? "bg-emerald-500" : percent >= 50 ? "bg-blue-500" : "bg-amber-400"
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-1">
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

export function ExecutionProjectListTable({
  rows,
  onChanged,
}: ExecutionProjectListTableProps) {
  const router = useRouter()

  const go = (href: string) => {
    router.push(href)
  }

  const handleNextStep = (
    e: MouseEvent,
    project: Project,
    summary: ProjectListSummary
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const step = resolveExecutionNextStep(project, summary)

    if (step.kind === "start") {
      updateProject(project.id, { status: "in_progress" })
      toast.success("Kivitelezés elindítva")
      onChanged?.()
      go(step.href)
      return
    }

    go(step.href)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] border-collapse text-sm">
          <thead className="ea-table-head text-xs">
            <tr>
              <th className="px-3 py-2.5 text-left">Projekt</th>
              <th className="px-3 py-2.5 text-left">Ügyfél</th>
              <th className="hidden px-3 py-2.5 text-left lg:table-cell">Helyszín</th>
              <th className="px-3 py-2.5 text-left">Állapot</th>
              <th className="px-3 py-2.5 text-right">Szerződés</th>
              <th className="px-3 py-2.5 text-right">Készültség</th>
              <th className="px-3 py-2.5 text-right">TIG</th>
              <th className="px-3 py-2.5 text-right">Következő lépés</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, summary }) => {
              const step = resolveExecutionNextStep(project, summary)
              const sentence = executionStatusSentence(project, summary)
              const pct = summary.executionPercent ?? summary.pricedPercent
              const rowHref = `/projektek/${project.id}?tab=quotes`

              return (
                <tr
                  key={project.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => go(rowHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      go(rowHref)
                    }
                  }}
                  className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50"
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
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="max-w-[10rem] px-3 py-3 align-middle">
                    <p className="truncate font-medium text-slate-800">
                      {project.clientName || "—"}
                    </p>
                  </td>
                  <td className="hidden max-w-[12rem] px-3 py-3 align-middle lg:table-cell">
                    <p className="truncate text-slate-600">
                      {project.siteAddress || "—"}
                    </p>
                  </td>
                  <td className="max-w-[14rem] px-3 py-3 align-middle">
                    <p className="text-sm font-medium leading-snug text-slate-800">
                      {sentence}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {formatHuf(summary.sellTotal)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <ReadinessBar percent={pct} />
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {summary.tigPercent != null ? `${summary.tigPercent}%` : "—"}
                    </span>
                    {(summary.eligibleTigLineCount ?? 0) > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-amber-700">
                        {summary.eligibleTigLineCount} készíthető
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <Button
                      size="sm"
                      variant={
                        step.kind === "tig" || step.kind === "start"
                          ? "default"
                          : "outline"
                      }
                      className="min-h-9"
                      onClick={(e) => handleNextStep(e, project, summary)}
                    >
                      {step.label}
                    </Button>
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
