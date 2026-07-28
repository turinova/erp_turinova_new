"use client"

import { AlertTriangle } from "lucide-react"
import type { Quote } from "@/types/projects"
import { listQuoteLines } from "@/lib/data/projects-store"
import type { TradeRfqSummary } from "@/lib/trade-rfq-summary"
import { Button } from "@/components/ui/button"
import { RfqPackageWorkspace } from "@/components/projektek/rfq-package-workspace"

type RfqTradeDetailPanelProps = {
  summary: TradeRfqSummary
  projectId: string
  quote: Quote
  onDecide: (packageId: string, intent: "decide" | "change") => void
  onStartRfq: (quoteId: string) => void
  onRefresh: () => void
}

export function RfqTradeDetailPanel({
  summary,
  projectId,
  quote,
  onDecide,
  onStartRfq,
  onRefresh,
}: RfqTradeDetailPanelProps) {
  const quoteLines = listQuoteLines(quote.id)

  return (
    <div className="space-y-1.5">
      {summary.hasOverlapWarning ? (
        <div className="mx-2 mt-1.5 flex items-start gap-1.5 border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <span className="font-medium">Átfedő bekérések: </span>
            {summary.overlappingLineLabels.join(", ")}
          </p>
        </div>
      ) : null}

      {summary.packages.length === 0 ? (
        <div className="px-3 py-3 text-center text-xs text-slate-600">
          <p>Még nincs bekérés ehhez a szakághoz.</p>
          <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => onStartRfq(quote.id)}>
            Új bekérés
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {summary.activePackages.map((p) => (
            <RfqPackageWorkspace
              key={p.pkg.id}
              pkgSummary={p}
              quoteLines={quoteLines}
              projectId={projectId}
              quote={quote}
              onDecide={onDecide}
              onRefresh={onRefresh}
              defaultCollapsed={!p.needsDecision && summary.activePackages.length > 1}
            />
          ))}
          {summary.decidedPackages.length > 0 ? (
            <div className="space-y-1">
              <p className="px-2.5 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Előzmények
              </p>
              {summary.decidedPackages.map((p) => (
                <RfqPackageWorkspace
                  key={p.pkg.id}
                  pkgSummary={p}
                  quoteLines={quoteLines}
                  projectId={projectId}
                  quote={quote}
                  onDecide={onDecide}
                  onRefresh={onRefresh}
                  defaultCollapsed
                  isHistory
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
