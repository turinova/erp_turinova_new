"use client"

import { AlertTriangle } from "lucide-react"
import { formatHuf } from "@/lib/pricing"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { cn } from "@/lib/utils"

type QuoteEditorKpiStripProps = {
  costTotal: number
  sellTotal: number
  marginTotal: number
  marginPercent: number | null
  unpricedCount: number
  isPartialTotal: boolean
  emphasis: "cost" | "markup" | "sell"
}

export function QuoteEditorKpiStrip({
  costTotal,
  sellTotal,
  marginTotal,
  marginPercent,
  unpricedCount,
  isPartialTotal,
  emphasis,
}: QuoteEditorKpiStripProps) {
  const marginTone =
    marginPercent == null || isPartialTotal
      ? "warning"
      : marginPercent < getMinAcceptableMarginPercent()
        ? "warning"
        : "success"

  return (
    <div className="sticky top-0 z-10 mb-4 overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
        <div
          className={cn(
            "min-w-0 overflow-hidden rounded-lg border-2 px-4 py-3",
            emphasis === "sell"
              ? "border-blue-200 bg-blue-50"
              : "border-slate-200 bg-slate-50"
          )}
        >
          <p
            className={cn(
              "ea-label text-base",
              emphasis === "sell" ? "text-blue-800" : "text-slate-600"
            )}
          >
            Ügyfél ára
          </p>
          <p
            className={cn(
              "ea-kpi-value truncate",
              emphasis === "sell" ? "text-blue-950" : "text-slate-900"
            )}
          >
            {formatHuf(sellTotal)}
          </p>
          {isPartialTotal ? (
            <p className="mt-1 text-sm font-medium text-amber-700">Csak árazott tételek</p>
          ) : null}
        </div>

        <div
          className={cn(
            "min-w-0 overflow-hidden rounded-lg border px-4 py-3",
            marginTone === "success"
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50",
            emphasis === "markup" && "ring-2 ring-amber-300"
          )}
        >
          <p
            className={cn(
              "ea-label text-base",
              marginTone === "success" ? "text-emerald-800" : "text-amber-900"
            )}
          >
            Fedezet
          </p>
          <p
            className={cn(
              "ea-kpi-value truncate",
              marginTone === "success" ? "text-emerald-950" : "text-amber-950"
            )}
          >
            {formatHuf(marginTotal)}
            {marginPercent != null ? (
              <span className="ml-1 text-lg font-semibold">({marginPercent}%)</span>
            ) : null}
          </p>
          {marginTone === "warning" && marginPercent != null && !isPartialTotal ? (
            <p className="mt-1 text-sm font-medium text-amber-800">
              Cél: min. {getMinAcceptableMarginPercent()}%
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "min-w-0 overflow-hidden rounded-lg border px-4 py-3",
            emphasis === "cost"
              ? "border-slate-300 bg-slate-100"
              : "border-slate-200 bg-slate-50"
          )}
        >
          <p className="ea-label text-base text-slate-600">Bekerülés</p>
          <p className="ea-kpi-value truncate text-slate-900">{formatHuf(costTotal)}</p>
        </div>
      </div>

      {unpricedCount > 0 ? (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <strong>{unpricedCount} tétel árazatlan</strong> — nem számít a végösszegbe. Árazd be a
            Bekerülés tabon.
          </p>
        </div>
      ) : null}
    </div>
  )
}
