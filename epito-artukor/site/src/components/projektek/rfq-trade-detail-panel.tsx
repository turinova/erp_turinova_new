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
}

export function RfqTradeDetailPanel({
  summary,
  projectId,
  quote,
  onDecide,
  onStartRfq,
}: RfqTradeDetailPanelProps) {
  const quoteLines = listQuoteLines(quote.id)

  return (
    <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 px-3 py-3">
      {summary.hasOverlapWarning ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Átfedő bekérések</p>
            <p className="mt-0.5 text-xs">
              Ugyanaz a tétel több nyitott bekérésben is szerepel:{" "}
              {summary.overlappingLineLabels.join(", ")}
            </p>
          </div>
        </div>
      ) : null}

      {summary.packages.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white px-4 py-6 text-center text-sm text-slate-600">
          <p>Még nincs bekérés ehhez a szakághoz.</p>
          <Button size="sm" className="mt-3" onClick={() => onStartRfq(quote.id)}>
            Új bekérés indítása
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {summary.activePackages.map((p) => (
            <RfqPackageWorkspace
              key={p.pkg.id}
              pkgSummary={p}
              quoteLines={quoteLines}
              projectId={projectId}
              quote={quote}
              onDecide={onDecide}
            />
          ))}
          {summary.decidedPackages.length > 0 ? (
            <div className="space-y-1 pt-1">
              <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
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
