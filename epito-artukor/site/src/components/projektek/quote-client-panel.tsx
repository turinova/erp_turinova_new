"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import type { Quote, QuoteLine } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import { QUOTE_EXCEL_COLUMNS } from "@/lib/quote-columns"
import {
  buildQuoteTradeBreakdown,
  calcQuoteVatTotals,
  resolveQuoteVatMode,
} from "@/lib/quote-client-summary"
import { isLineCosted } from "@/lib/quote-pricing"
import {
  lineSellLaborTotal,
  lineSellMaterialTotal,
  lineSellTotal,
  quoteSellTotals,
} from "@/lib/quote-utils"
import { unitMap } from "@/lib/data/units-store"
import { QuoteTableFooterSummary } from "@/components/projektek/quote-table-footer-summary"
import { cn } from "@/lib/utils"

export type QuoteClientSubView = "summary" | "lines"

type QuoteClientPanelProps = {
  quote: Quote
  lines: QuoteLine[]
  displayLines: QuoteLine[]
  subView: QuoteClientSubView
}

const COL = QUOTE_EXCEL_COLUMNS

export function QuoteClientPanel({
  quote,
  lines,
  displayLines,
  subView,
}: QuoteClientPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const breakdown = useMemo(() => buildQuoteTradeBreakdown(quote, lines), [quote, lines])
  const vatMode = resolveQuoteVatMode(quote)
  const vatTotals = useMemo(
    () => calcQuoteVatTotals(breakdown.totals.sellNetTotal, vatMode),
    [breakdown.totals.sellNetTotal, vatMode]
  )

  const displaySellTotals = useMemo(
    () => quoteSellTotals(displayLines.filter(isLineCosted), quote),
    [displayLines, quote]
  )

  const footerLabel = subView === "summary" ? "Összesítő" : "Tételek összesen"

  const footerCells =
    subView === "summary"
      ? [
          {
            label: "Nettó",
            value: formatHuf(vatTotals.netTotal),
            tone: "blue" as const,
          },
          {
            label: vatTotals.showVatAmount ? vatTotals.vatLabel : "ÁFA",
            value: formatHuf(vatTotals.vatAmount),
            tone: "amber" as const,
          },
          {
            label: "Bruttó",
            value: formatHuf(vatTotals.grossTotal),
            tone: "blue" as const,
            emphasis: true,
          },
        ]
      : [
          {
            label: COL.materialTotal,
            value: formatHuf(displaySellTotals.material),
            tone: "material" as const,
          },
          {
            label: COL.laborTotal,
            value: formatHuf(displaySellTotals.labor),
            tone: "labor" as const,
          },
          {
            label: "Nettó",
            value: formatHuf(displaySellTotals.total),
            tone: "blue" as const,
            emphasis: true,
          },
        ]

  const internalSummaryLine = `Bekerülés ${formatHuf(breakdown.totals.costTotal)} · Fedezet ${formatHuf(breakdown.totals.marginTotal)}${breakdown.totals.marginPercent != null ? ` (${breakdown.totals.marginPercent}%)` : ""}`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          {subView === "summary" ? (
            <table className="w-full min-w-[640px] text-xs">
              <thead className="ea-table-head sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-2 py-1.5 text-left">Szakág</th>
                  <th className="px-2 py-1.5 text-left">Tétel</th>
                  <th className="px-2 py-1.5 text-right">{COL.materialTotal}</th>
                  <th className="px-2 py-1.5 text-right">{COL.laborTotal}</th>
                  <th className="px-2 py-1.5 text-right">Összesen</th>
                  <th className="px-2 py-1.5 text-right">Arány</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-sm text-slate-500">
                      {breakdown.totals.lineCount === 0
                        ? "Nincs tétel az árajánlatban."
                        : "Minden tétel árazatlan — nincs megjeleníthető összeg."}
                    </td>
                  </tr>
                ) : (
                  breakdown.rows.map((row) => (
                    <tr key={row.trade} className="border-b hover:bg-slate-50/80 [&_td]:align-top">
                      <td className="px-2 py-1.5 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1">
                          {row.label}
                          {row.marginLow ? (
                            <span title="Alacsony fedezet ezen a szakágon">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {row.lineCount}
                        {row.unpricedCount > 0 ? (
                          <span className="text-amber-800"> ({row.unpricedCount} árazatlan)</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                        {formatHuf(row.sellMaterialTotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                        {formatHuf(row.sellLaborTotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-blue-900">
                        {formatHuf(row.sellNetTotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {row.sharePercent != null ? `${row.sharePercent}%` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[800px] text-xs">
              <thead className="ea-table-head sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-2 py-1.5">{COL.ssz}</th>
                  <th className="px-2 py-1.5">{COL.identifier}</th>
                  <th className="px-2 py-1.5">{COL.text}</th>
                  <th className="px-2 py-1.5">{COL.quantity}</th>
                  <th className="px-2 py-1.5">{COL.unit}</th>
                  <th className="px-2 py-1.5 text-right">{COL.materialTotal}</th>
                  <th className="px-2 py-1.5 text-right">{COL.laborTotal}</th>
                  <th className="px-2 py-1.5 text-right">Összesen</th>
                </tr>
              </thead>
              <tbody>
                {displayLines.map((line, i) => {
                  const costed = isLineCosted(line)
                  return (
                    <tr key={line.id} className="border-b hover:bg-slate-50/80 [&_td]:align-top">
                      <td className="px-2 py-1.5 font-code text-slate-600">{i + 1}</td>
                      <td className="px-2 py-1.5 font-code font-medium text-blue-700">
                        {line.identifierSnapshot}
                      </td>
                      <td className="min-w-[12rem] max-w-md px-2 py-1.5">
                        <span className="block whitespace-normal break-words leading-snug text-slate-900">
                          {line.textSnapshot}
                        </span>
                        {!costed ? (
                          <span className="text-amber-800">árazatlan</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-slate-700">
                        {line.quantity}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {unitMap[line.unitId]?.code}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                        {costed ? formatHuf(lineSellMaterialTotal(line, quote)) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                        {costed ? formatHuf(lineSellLaborTotal(line, quote)) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-blue-900">
                        {costed ? formatHuf(lineSellTotal(line, quote)) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {subView === "lines" && displayLines.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <p>Nincs megjeleníthető tétel.</p>
            </div>
          ) : null}
        </div>

        {(subView === "summary" && breakdown.rows.length > 0) ||
        (subView === "lines" && displayLines.length > 0) ? (
          <QuoteTableFooterSummary
            label={footerLabel}
            cells={footerCells}
          />
        ) : null}
      </div>

      {breakdown.rows.length > 0 ? (
        <div className="mt-1 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs"
            onClick={() => setInternalOpen((v) => !v)}
          >
            <span className="font-medium text-slate-700">
              Belső összesítő
              {!internalOpen ? (
                <span className="ml-2 font-normal tabular-nums text-slate-600">
                  {internalSummaryLine}
                </span>
              ) : null}
            </span>
            {internalOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
          </button>
          {internalOpen ? (
            <div className="border-t bg-white">
              <p className="px-2 py-1 text-[11px] text-slate-500">
                Nem megy ki exportban — csak belső ellenőrzés.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="ea-table-head">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Szakág</th>
                      <th className="px-2 py-1.5 text-right">Bekerülés</th>
                      <th className="px-2 py-1.5 text-right">Fedezet</th>
                      <th className="px-2 py-1.5 text-right">%</th>
                      <th className="px-2 py-1.5 text-right">Ügyfél nettó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.rows.map((row) => (
                      <tr key={row.trade} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5 text-slate-900">{row.label}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-zinc-800">
                          {formatHuf(row.costTotal)}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-1.5 text-right tabular-nums",
                            row.marginLow ? "text-amber-800" : "text-emerald-800"
                          )}
                        >
                          {formatHuf(row.marginTotal)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                          {row.marginPercent != null ? `${row.marginPercent}%` : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium text-blue-900">
                          {formatHuf(row.sellNetTotal)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-medium">
                      <td className="px-2 py-1.5 text-slate-900">Összesen</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-900">
                        {formatHuf(breakdown.totals.costTotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-900">
                        {formatHuf(breakdown.totals.marginTotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {breakdown.totals.marginPercent != null
                          ? `${breakdown.totals.marginPercent}%`
                          : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-blue-900">
                        {formatHuf(breakdown.totals.sellNetTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {vatTotals.vatNote ? (
        <p className="mt-1 shrink-0 text-[11px] text-slate-600">{vatTotals.vatNote}</p>
      ) : null}
    </div>
  )
}
