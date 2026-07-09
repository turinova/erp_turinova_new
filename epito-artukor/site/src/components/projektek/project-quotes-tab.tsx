"use client"

import { useMemo } from "react"
import { ClipboardPaste, Plus } from "lucide-react"
import type { Project, Quote } from "@/types/projects"
import type { QuoteSummary } from "@/lib/quote-summary"
import { formatHuf } from "@/lib/pricing"
import { calcQuoteVatTotals, resolveQuoteVatMode } from "@/lib/quote-client-summary"
import { Button } from "@/components/ui/button"
import { QuoteListTable } from "@/components/projektek/quote-list-table"
import { QuoteTableFooterSummary } from "@/components/projektek/quote-table-footer-summary"

type ProjectQuotesTabProps = {
  project: Project
  projectId: string
  quotes: Quote[]
  quoteSummaries: Map<string, QuoteSummary>
  onNewQuote: () => void
  onImportQuote: () => void
  onDuplicate: (quoteId: string) => void
  onDelete: (quoteId: string) => void
  onArchive: (quoteId: string) => void
  onStartRfq: (quoteId: string) => void
  onExportPdf: (quoteId: string) => void
}

export function ProjectQuotesTab({
  project,
  quotes,
  quoteSummaries,
  onNewQuote,
  onImportQuote,
  onDuplicate,
  onDelete,
  onArchive,
  onStartRfq,
  onExportPdf,
}: ProjectQuotesTabProps) {
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

  const footerTotals = useMemo(() => {
    let costTotal = 0
    let sellTotal = 0
    let sellGrossTotal = 0
    let marginTotal = 0
    let hasAnyLine = false
    let partial = false
    const vatModes = new Set<string>()

    for (const q of activeQuotes) {
      const s = quoteSummaries.get(q.id)
      if (!s || s.lineCount === 0) continue
      hasAnyLine = true
      costTotal += s.costTotal
      sellTotal += s.sellTotal
      marginTotal += s.marginTotal
      const vatMode = resolveQuoteVatMode(q)
      vatModes.add(vatMode)
      sellGrossTotal += calcQuoteVatTotals(s.sellTotal, vatMode).grossTotal
      if (s.isPartialTotal) partial = true
    }

    const marginPercent =
      sellTotal > 0 && hasAnyLine ? Math.round((marginTotal / sellTotal) * 100) : null

    return {
      costTotal,
      sellTotal,
      sellGrossTotal,
      marginTotal,
      marginPercent,
      hasAnyLine,
      partial,
      mixedVat: vatModes.size > 1,
    }
  }, [activeQuotes, quoteSummaries])

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-100 bg-white px-5 py-3.5 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">Költségvetés</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
            {activeQuotes.length} szakág
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
          <Button size="sm" variant="outline" className="h-9 text-sm" onClick={onImportQuote}>
            <ClipboardPaste className="mr-1.5 h-4 w-4" />
            Gyors beillesztés
          </Button>
          <Button size="sm" className="h-9 text-sm" onClick={onNewQuote}>
            <Plus className="mr-1.5 h-4 w-4" />
            Új szakág hozzáadása
          </Button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="max-w-sm text-sm text-slate-600">
            Még nincs költségvetés ehhez a projekthez. Illeszd be az Excel tételneveit, vagy adj hozzá
            egy szakágot kézzel.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" onClick={onImportQuote}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Gyors beillesztés
            </Button>
            <Button size="sm" onClick={onNewQuote}>
              <Plus className="mr-2 h-4 w-4" />
              Első szakág hozzáadása
            </Button>
          </div>
        </div>
      ) : (
        <>
          <QuoteListTable
            rows={rows}
            projectId={project.id}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onArchive={onArchive}
            onStartRfq={onStartRfq}
            onExportPdf={onExportPdf}
          />
          {footerTotals.hasAnyLine ? (
            <QuoteTableFooterSummary
              label="Teljes projekt (aktív szakágok)"
              cells={[
                {
                  label: "Bekerülés (nettó)",
                  value: formatHuf(footerTotals.costTotal),
                  tone: "cost",
                },
                {
                  label: "Fedezet (nettó)",
                  value: formatHuf(footerTotals.marginTotal),
                  suffix:
                    footerTotals.marginPercent != null
                      ? `${footerTotals.marginPercent}%`
                      : undefined,
                  tone: "emerald",
                },
                {
                  label: "Eladás (nettó)",
                  value: formatHuf(footerTotals.sellTotal),
                  tone: "blue",
                },
                {
                  label: "Bruttó (ügyfélnek)",
                  value: formatHuf(footerTotals.sellGrossTotal),
                  suffix: footerTotals.mixedVat ? "vegyes ÁFA" : undefined,
                  tone: "blue",
                  emphasis: true,
                },
              ]}
              partialWarning={footerTotals.partial}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
