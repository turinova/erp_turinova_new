"use client"

import { useMemo, useState, useEffect, Fragment } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react"
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
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardQuoteId, setWizardQuoteId] = useState<string | null>(null)
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
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
      .sort((a, b) => a.tradeLabel.localeCompare(b.tradeLabel, "hu"))
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
      case "wait":
      case "view":
        setExpandedQuoteId(summary.quote.id)
        return
      default:
        setExpandedQuoteId(summary.quote.id)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-[var(--background)]">
        <div className="flex h-auto min-h-9 flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Alvállalkozók ({activeQuotes.length} szakág)
            </h2>
          </div>

          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {rfqQuoteFilter ? (
              <div className="flex items-center gap-2 rounded-full border bg-slate-50 px-2.5 py-1 text-xs">
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
              <Badge variant="warning" className="text-[11px]">
                {stats.pendingDecision} döntésre vár
              </Badge>
            ) : null}
            {stats.awaiting > 0 ? (
              <Badge variant="outline" className="text-[11px]">
                {stats.awaiting} vár válaszra
              </Badge>
            ) : null}
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => openCreateDialog(rfqQuoteFilter ?? undefined)}
              disabled={!activeQuotes.length}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Új bekérés
            </Button>
          </div>
        </div>

        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
          Szakágonként követheted a bekéréseket. Küldd ki a linkeket, hasonlítsd össze az ajánlatokat,
          majd egy nyertest választasz — a bekerülés automatikusan beíródik.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tradeSummaries.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">
            {rfqQuoteFilter
              ? "Ehhez a szakághoz még nincs költségvetés."
              : "Előbb hozz létre költségvetést a Költségvetés fülön."}
          </p>
        ) : (
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="w-8 px-2 py-2" />
                <th className="px-4 py-2">Szakág</th>
                <th className="px-4 py-2">Következő lépés</th>
                <th className="px-4 py-2">Bekérések</th>
                <th className="px-4 py-2">Ajánlatok</th>
                <th className="px-4 py-2 text-right">Művelet</th>
              </tr>
            </thead>
            <tbody>
              {tradeSummaries.map((summary) => {
                const expanded = expandedQuoteId === summary.quote.id
                const { todo } = summary
                const activeCount = summary.activePackages.length
                const totalRounds = summary.packages.length

                return (
                  <Fragment key={summary.quote.id}>
                    <tr
                      className={cn(
                        "border-b border-slate-100 hover:bg-slate-50/60",
                        todo.tone === "warning" && "bg-amber-50/30",
                        todo.tone === "success" && "bg-emerald-50/20"
                      )}
                    >
                      <td className="px-2 py-3 align-middle">
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() =>
                            setExpandedQuoteId(expanded ? null : summary.quote.id)
                          }
                          aria-label={expanded ? "Összecsukás" : "Részletek"}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="min-w-[8rem]">
                          <Link
                            href={`/projektek/${projectId}/ajanlat/${summary.quote.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-800 hover:underline"
                          >
                            {summary.tradeLabel}
                          </Link>
                          {summary.quote.title !== summary.tradeLabel ? (
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {summary.quote.title}
                            </p>
                          ) : null}
                          {summary.hasOverlapWarning ? (
                            <Badge
                              variant="outline"
                              className="mt-1 border-amber-300 bg-amber-50 text-[10px] text-amber-900"
                            >
                              Átfedés
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <button
                          type="button"
                          className={cn(
                            "text-left",
                            todo.actionable && "hover:underline"
                          )}
                          disabled={!todo.actionable}
                          onClick={() => todo.actionable && handleTodoAction(summary, todo.action)}
                        >
                          <p className={cn("font-medium", todoToneClass(todo.tone))}>
                            {todo.label}
                          </p>
                          {todo.detail ? (
                            <p className="mt-0.5 text-xs text-slate-500">{todo.detail}</p>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-middle tabular-nums text-slate-700">
                        {totalRounds === 0 ? (
                          "—"
                        ) : (
                          <>
                            {activeCount > 0 ? `${activeCount} aktív` : "0 aktív"}
                            {totalRounds > 0 ? ` · ${totalRounds} kör` : ""}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-700">
                        {summary.offerLabel ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex justify-end gap-1">
                          {todo.action === "decide" && todo.packageId ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs"
                              onClick={() => openDecision(todo.packageId!, "decide")}
                            >
                              Döntés
                            </Button>
                          ) : todo.action === "start" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => openCreateDialog(summary.quote.id)}
                            >
                              Bekérés
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => setExpandedQuoteId(summary.quote.id)}
                            >
                              Részletek
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <RfqTradeDetailPanel
                            summary={summary}
                            projectId={projectId}
                            quote={summary.quote}
                            onDecide={openDecision}
                            onStartRfq={openCreateDialog}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <RfqCreateWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        quotes={quotes}
        initialQuoteId={wizardQuoteId}
        onCreated={(quoteIds) => {
          onRefresh()
          if (quoteIds.length === 1) setExpandedQuoteId(quoteIds[0])
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
