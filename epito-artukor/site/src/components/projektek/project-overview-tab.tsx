"use client"

import { useMemo } from "react"
import { buildProjectOverviewSummary } from "@/lib/project-overview-summary"
import { buildOverviewKpis, buildTradeDashboardRows } from "@/lib/project-overview-dashboard"
import { buildExecutionSummary } from "@/lib/execution-summary"
import { ProjectOverviewTradeTable } from "@/components/projektek/project-overview-trade-table"
import { ProjectOverviewFinancialSummary } from "@/components/projektek/project-overview-financial-summary"
import { ProjectOverviewActivityFeed } from "@/components/projektek/project-overview-activity-feed"
import { ProjectTigHistoryPanel } from "@/components/projektek/project-tig-history-panel"
import {
  ProjectExecutionKpis,
  ProjectSupplementCallout,
} from "@/components/projektek/project-execution-panels"

type ProjectOverviewTabProps = {
  projectId: string
  tick: number
  onDuplicate: (quoteId: string) => void
  onDelete: (quoteId: string) => void
  onArchive: (quoteId: string) => void
  onStartRfq: (quoteId: string) => void
  onExportPdf?: (quoteId: string) => void
  onOpenOfferTab?: () => void
}

export function ProjectOverviewTab({
  projectId,
  tick,
  onDuplicate,
  onDelete,
  onArchive,
  onStartRfq,
  onExportPdf,
  onOpenOfferTab,
}: ProjectOverviewTabProps) {
  const overview = useMemo(() => {
    void tick
    return buildProjectOverviewSummary(projectId)
  }, [projectId, tick])

  const kpis = useMemo(() => {
    void tick
    return buildOverviewKpis(projectId)
  }, [projectId, tick])

  const tradeRows = useMemo(() => {
    void tick
    return buildTradeDashboardRows(projectId)
  }, [projectId, tick])

  const executionSummary = useMemo(() => {
    void tick
    return buildExecutionSummary(projectId)
  }, [projectId, tick])

  if (!overview) {
    return <p className="text-sm text-slate-500">Az áttekintés nem elérhető.</p>
  }

  const { activity } = overview

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-100 bg-white px-5 py-3.5">
        <h2 className="text-base font-semibold text-slate-900">Áttekintés</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="space-y-5 p-5">
          <ProjectOverviewFinancialSummary projectId={projectId} kpis={kpis} />

          {kpis.mode === "execution" ? (
            <>
              <ProjectExecutionKpis projectId={projectId} summary={executionSummary} />
              <ProjectSupplementCallout
                projectId={projectId}
                summary={executionSummary}
                onOpenOfferTab={onOpenOfferTab}
              />
              <ProjectTigHistoryPanel projectId={projectId} tick={tick} />
            </>
          ) : null}

          <ProjectOverviewTradeTable
            rows={tradeRows}
            projectId={projectId}
            executionMode={kpis.mode === "execution"}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onArchive={onArchive}
            onStartRfq={onStartRfq}
            onExportPdf={onExportPdf}
          />

          <ProjectOverviewActivityFeed items={activity} />
        </div>
      </div>
    </div>
  )
}
