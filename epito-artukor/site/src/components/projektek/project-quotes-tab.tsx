"use client"

import { useMemo, useState } from "react"
import { ClipboardPaste, Plus, ChevronDown, ChevronRight, FilePlus2 } from "lucide-react"
import type { Project, Quote } from "@/types/projects"
import type { QuoteSummary } from "@/lib/quote-summary"
import { buildOverviewKpis } from "@/lib/project-overview-dashboard"
import { buildExecutionSummary } from "@/lib/execution-summary"
import { buildProjectOverviewSummary } from "@/lib/project-overview-summary"
import { buildQuoteContractContextMap } from "@/lib/quote-contract-context"
import {
  listOfferSelectableQuotes,
  listQuoteIdsInDraftPackages,
} from "@/lib/data/projects-store"
import { Button } from "@/components/ui/button"
import { QuoteListTable } from "@/components/projektek/quote-list-table"
import { ProjectOverviewFinancialSummary } from "@/components/projektek/project-overview-financial-summary"
import { ProjectOverviewActivityFeed } from "@/components/projektek/project-overview-activity-feed"
import { ProjectTigHistoryPanel } from "@/components/projektek/project-tig-history-panel"
import { ProjectOfferCreateDialog } from "@/components/projektek/project-offer-create-dialog"
import {
  ProjectExecutionKpis,
  ProjectSupplementCallout,
} from "@/components/projektek/project-execution-panels"

type ProjectQuotesTabProps = {
  project: Project
  projectId: string
  quotes: Quote[]
  quoteSummaries: Map<string, QuoteSummary>
  tick: number
  onNewQuote: (opts?: { potmunka?: boolean }) => void
  onImportQuote: () => void
  onDuplicate: (quoteId: string) => void
  onDelete: (quoteId: string) => void
  onArchive: (quoteId: string) => void
  onStartRfq: (quoteId: string) => void
  onOpenOfferTab?: () => void
  onRefresh?: () => void
}

export function ProjectQuotesTab({
  project,
  projectId,
  quotes,
  quoteSummaries,
  tick,
  onNewQuote,
  onImportQuote,
  onDuplicate,
  onDelete,
  onArchive,
  onStartRfq,
  onOpenOfferTab,
  onRefresh,
}: ProjectQuotesTabProps) {
  const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [offerCreateOpen, setOfferCreateOpen] = useState(false)
  const [offerInitialIds, setOfferInitialIds] = useState<string[]>([])
  const [offerAsSupplement, setOfferAsSupplement] = useState(false)

  const activeQuotes = useMemo(
    () => quotes.filter((q) => q.status !== "archived"),
    [quotes]
  )

  const rows = useMemo(
    () =>
      quotes
        .map((q) => {
          const summary = quoteSummaries.get(q.id)
          return summary ? { quote: q, summary } : null
        })
        .filter((r): r is { quote: Quote; summary: QuoteSummary } => r != null),
    [quotes, quoteSummaries]
  )

  const kpis = useMemo(() => {
    void tick
    return buildOverviewKpis(projectId)
  }, [projectId, tick])

  const executionSummary = useMemo(() => {
    void tick
    return buildExecutionSummary(projectId)
  }, [projectId, tick])

  const activity = useMemo(() => {
    void tick
    return buildProjectOverviewSummary(projectId)?.activity ?? []
  }, [projectId, tick])

  const contractMap = useMemo(() => {
    void tick
    return buildQuoteContractContextMap(projectId)
  }, [projectId, tick])

  const selectableForOffer = useMemo(() => {
    void tick
    return listOfferSelectableQuotes(projectId)
  }, [projectId, tick])

  const draftLockedIds = useMemo(() => {
    void tick
    return new Set(listQuoteIdsInDraftPackages(projectId))
  }, [projectId, tick])

  const unpricedCount = useMemo(
    () =>
      activeQuotes.reduce((sum, q) => {
        const s = quoteSummaries.get(q.id)
        return sum + (s?.unpricedCount ?? 0)
      }, 0),
    [activeQuotes, quoteSummaries]
  )

  const isExecution = kpis.mode === "execution"

  const handleCreateOfferFromSelection = (quoteIds: string[]) => {
    setOfferInitialIds(quoteIds)
    setOfferAsSupplement(isExecution)
    setOfferCreateOpen(true)
  }

  const handleOfferCreated = () => {
    setOfferCreateOpen(false)
    setOfferInitialIds([])
    setOfferAsSupplement(false)
    onRefresh?.()
    onOpenOfferTab?.()
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-100 bg-white px-5 py-4 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Költségvetés</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">
            {activeQuotes.length} szakág
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
          <Button className="h-11 text-sm font-semibold" onClick={onImportQuote}>
            <ClipboardPaste className="mr-1.5 h-4 w-4" />
            Excel tételek beillesztése
          </Button>
          {isExecution ? (
            <Button
              variant="outline"
              className="h-11 text-sm font-semibold"
              onClick={() => onNewQuote({ potmunka: true })}
            >
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              Pótmunka szakág
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-11 text-sm font-semibold"
              onClick={() => onNewQuote()}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Új szakág
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="space-y-4 px-5 py-4">
          <ProjectOverviewFinancialSummary kpis={kpis} unpricedCount={unpricedCount} />

          {isExecution && executionSummary.pendingSupplements.length > 0 ? (
            <ProjectSupplementCallout
              projectId={projectId}
              summary={executionSummary}
              onOpenOfferTab={onOpenOfferTab}
            />
          ) : null}

          {quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <p className="max-w-md text-base text-slate-700">
                Még nincs költségvetés ehhez a projekthez. Illeszd be az Excel tételneveit, vagy adj
                hozzá egy szakágot kézzel.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="h-11 text-sm font-semibold" onClick={onImportQuote}>
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  Excel tételek beillesztése
                </Button>
                <Button
                  variant="outline"
                  className="h-11 text-sm font-semibold"
                  onClick={() => onNewQuote()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Első szakág
                </Button>
              </div>
            </div>
          ) : (
            <div className="-mx-5">
              <QuoteListTable
                rows={rows}
                projectId={project.id}
                contractMap={contractMap}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onArchive={onArchive}
                onStartRfq={onStartRfq}
                onCreateOffer={handleCreateOfferFromSelection}
              />
            </div>
          )}

          {isExecution ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setExecutionDetailsOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-2.5 text-left"
              >
                <p className="text-sm font-semibold text-slate-900">Kivitelezés részletei</p>
                {executionDetailsOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </button>
              {executionDetailsOpen ? (
                <div className="space-y-4 border-t border-slate-100 p-4">
                  <ProjectExecutionKpis projectId={projectId} summary={executionSummary} />
                  <ProjectTigHistoryPanel projectId={projectId} tick={tick} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setActivityOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-left"
            >
              <p className="text-base font-semibold text-slate-900">
                Tevékenység
                {activity.length > 0 ? (
                  <span className="ml-2 font-normal text-slate-500">({activity.length})</span>
                ) : null}
              </p>
              {activityOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {activityOpen ? (
              <div className="border-t border-slate-100">
                <ProjectOverviewActivityFeed items={activity} embedded />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ProjectOfferCreateDialog
        open={offerCreateOpen}
        onOpenChange={(open) => {
          setOfferCreateOpen(open)
          if (!open) {
            setOfferInitialIds([])
            setOfferAsSupplement(false)
          }
        }}
        projectId={projectId}
        selectable={selectableForOffer}
        draftLockedIds={draftLockedIds}
        initialQuoteIds={offerInitialIds}
        defaultType={offerAsSupplement ? "supplement" : "full"}
        onCreated={handleOfferCreated}
      />
    </div>
  )
}
