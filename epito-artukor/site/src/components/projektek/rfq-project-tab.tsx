"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import type { Project, Quote } from "@/types/projects"
import {
  listInvitationsForPackage,
  listQuoteLines,
  listRfqsForProject,
  listSubmissionsForPackage,
} from "@/lib/data/projects-store"
import {
  buildProjectRfqStats,
  buildTradeRfqSummary,
  type RfqTodoAction,
  type TradeRfqSummary,
} from "@/lib/trade-rfq-summary"
import { getWinningInvitationForPackage } from "@/lib/quote-rfq-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QuoteRfqDecisionDialog } from "@/components/projektek/quote-rfq-decision-dialog"
import { RfqTradeDetailPanel } from "@/components/projektek/rfq-trade-detail-panel"
import { RfqCreateWizard } from "@/components/projektek/rfq-create-wizard"
import { cn } from "@/lib/utils"

type RfqProjectTabProps = {
  project: Project
  projectId: string
  quotes: Quote[]
  rfqQuoteFilter: string | null
  onClearQuoteFilter: () => void
  tick: number
  onRefresh: () => void
  autoOpenCreate?: boolean
  onAutoOpenHandled?: () => void
  initialQuoteId?: string | null
}

function todoToneClass(tone: TradeRfqSummary["todo"]["tone"]): string {
  if (tone === "warning") return "text-amber-900"
  if (tone === "success") return "text-emerald-900"
  return "text-slate-700"
}

export function RfqProjectTab({
  project,
  projectId,
  quotes,
  rfqQuoteFilter,
  onClearQuoteFilter,
  tick,
  onRefresh,
  autoOpenCreate,
  onAutoOpenHandled,
  initialQuoteId,
}: RfqProjectTabProps) {
  void project
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardQuoteId, setWizardQuoteId] = useState<string | null>(null)
  const [decisionPkgId, setDecisionPkgId] = useState<string | null>(null)
  const [decisionIntent, setDecisionIntent] = useState<"decide" | "change">("decide")

  const activeQuotes = useMemo(
    () => quotes.filter((q) => q.status !== "archived"),
    [quotes]
  )

  const allPackages = useMemo(() => {
    void tick
    return listRfqsForProject(projectId)
  }, [projectId, tick])

  const tradeSummaries = useMemo(() => {
    void tick
    const filteredQuotes = rfqQuoteFilter
      ? activeQuotes.filter((q) => q.id === rfqQuoteFilter)
      : activeQuotes

    return filteredQuotes
      .map((quote) => {
        const quoteLines = listQuoteLines(quote.id)
        const invitations = allPackages
          .filter((p) => p.quoteId === quote.id)
          .flatMap((p) => listInvitationsForPackage(p.id))
        const submissions = allPackages
          .filter((p) => p.quoteId === quote.id)
          .flatMap((p) => listSubmissionsForPackage(p.id))
        return buildTradeRfqSummary(quote, quoteLines, allPackages, invitations, submissions)
      })
      .sort((a, b) => {
        const order = (s: TradeRfqSummary) => {
          if (s.todo.tone === "warning") return 0
          if (s.packages.length > 0 && s.todo.action !== "start") return 1
          if (s.todo.action === "start") return 3
          return 2
        }
        const d = order(a) - order(b)
        if (d !== 0) return d
        return a.tradeLabel.localeCompare(b.tradeLabel, "hu")
      })
  }, [activeQuotes, allPackages, rfqQuoteFilter, tick])

  const stats = useMemo(() => buildProjectRfqStats(tradeSummaries), [tradeSummaries])

  const openCreateDialog = (quoteId?: string) => {
    if (activeQuotes.length === 0) {
      toast.error("Előbb hozz létre költségvetést")
      return
    }
    if (quoteId) {
      const lines = listQuoteLines(quoteId)
      if (lines.length === 0) {
        toast.error("Előbb adj hozzá tételeket")
        return
      }
    }
    setWizardQuoteId(quoteId ?? null)
    setCreateOpen(true)
  }

  useEffect(() => {
    if (!autoOpenCreate) return
    openCreateDialog(initialQuoteId ?? rfqQuoteFilter ?? undefined)
    onAutoOpenHandled?.()
  }, [autoOpenCreate, initialQuoteId, rfqQuoteFilter, quotes.length])

  const openDecision = (packageId: string, intent: "decide" | "change") => {
    setDecisionIntent(intent)
    setDecisionPkgId(packageId)
  }

  const decisionPkg = decisionPkgId ? allPackages.find((p) => p.id === decisionPkgId) : null
  const decisionQuote = decisionPkg ? quotes.find((q) => q.id === decisionPkg.quoteId) : null

  const handleTodoAction = (summary: TradeRfqSummary, action: RfqTodoAction) => {
    switch (action) {
      case "decide":
        if (summary.todo.packageId) {
          const pkg = allPackages.find((p) => p.id === summary.todo.packageId)
          if (pkg?.status === "decided") openDecision(summary.todo.packageId, "change")
          else openDecision(summary.todo.packageId, "decide")
        }
        return
      case "start":
        openCreateDialog(summary.quote.id)
        return
      default:
        return
    }
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-[var(--background)]">
        <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-1.5">
          <h2 className="shrink-0 text-sm font-semibold text-slate-900">Bekérés</h2>

          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
            {rfqQuoteFilter ? (
              <div className="flex items-center gap-1.5 rounded border bg-slate-50 px-2 py-0.5 text-[11px]">
                <span className="max-w-[10rem] truncate">
                  {quotes.find((q) => q.id === rfqQuoteFilter)?.title}
                </span>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-800"
                  onClick={onClearQuoteFilter}
                >
                  ✕
                </button>
              </div>
            ) : null}
            {stats.pendingDecision > 0 ? (
              <Badge variant="warning" className="h-5 px-1.5 text-[10px]">
                {stats.pendingDecision} döntés
              </Badge>
            ) : null}
            {stats.awaiting > 0 ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {stats.awaiting} vár
              </Badge>
            ) : null}
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => openCreateDialog(rfqQuoteFilter ?? undefined)}
              disabled={!activeQuotes.length}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Új bekérés
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        {tradeSummaries.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-600">
            {rfqQuoteFilter
              ? "Ehhez a szakághoz még nincs költségvetés."
              : "Előbb hozz létre költségvetést a Költségvetés fülön."}
          </p>
        ) : (
          tradeSummaries.map((summary) => {
            const { todo } = summary
            const hasPackages = summary.packages.length > 0

            return (
              <section
                key={summary.quote.id}
                className={cn(
                  "overflow-hidden border border-slate-200 bg-white",
                  todo.tone === "warning" && "border-amber-400",
                  todo.tone === "success" && "border-emerald-300"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                      <Link
                        href={`/projektek/${projectId}/ajanlat/${summary.quote.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-800 hover:underline"
                      >
                        {summary.tradeLabel}
                      </Link>
                      {summary.quote.title !== summary.tradeLabel ? (
                        <span className="truncate text-[11px] text-slate-500">
                          {summary.quote.title}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={cn(
                          "text-left text-[11px]",
                          todo.actionable && "hover:underline",
                          todoToneClass(todo.tone)
                        )}
                        disabled={!todo.actionable}
                        onClick={() => todo.actionable && handleTodoAction(summary, todo.action)}
                      >
                        <span className="font-medium">{todo.label}</span>
                        {todo.detail ? (
                          <span className="text-slate-500"> · {todo.detail}</span>
                        ) : null}
                      </button>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {summary.offerLabel ? (
                      <span className="text-[11px] text-slate-600">{summary.offerLabel}</span>
                    ) : null}
                    {todo.action === "decide" && todo.packageId ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openDecision(todo.packageId!, "decide")}
                      >
                        Döntés
                      </Button>
                    ) : todo.action === "start" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openCreateDialog(summary.quote.id)}
                      >
                        Indítás
                      </Button>
                    ) : null}
                  </div>
                </div>

                {hasPackages ? (
                  <RfqTradeDetailPanel
                    summary={summary}
                    projectId={projectId}
                    quote={summary.quote}
                    onDecide={openDecision}
                    onStartRfq={openCreateDialog}
                    onRefresh={onRefresh}
                  />
                ) : (
                  <div className="px-2.5 py-2 text-center text-xs text-slate-500">
                    Még nincs bekérés.
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>

      <RfqCreateWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        quotes={quotes}
        initialQuoteId={wizardQuoteId}
        onCreated={() => {
          onRefresh()
        }}
      />

      {decisionPkg && decisionQuote ? (
        <QuoteRfqDecisionDialog
          open={!!decisionPkgId}
          onOpenChange={(o) => !o && setDecisionPkgId(null)}
          intent={decisionIntent}
          pkg={decisionPkg}
          quote={decisionQuote}
          quoteLines={listQuoteLines(decisionQuote.id)}
          invitations={listInvitationsForPackage(decisionPkg.id)}
          submissions={listSubmissionsForPackage(decisionPkg.id)}
          winningInvitationId={
            getWinningInvitationForPackage(
              decisionPkg,
              listInvitationsForPackage(decisionPkg.id),
              listQuoteLines(decisionQuote.id)
            )?.id ?? null
          }
          onApplied={onRefresh}
        />
      ) : null}
    </div>
  )
}
