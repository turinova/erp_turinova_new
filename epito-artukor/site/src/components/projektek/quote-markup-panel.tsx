"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Quote, QuoteLine } from "@/types/projects"
import type { Trade } from "@/types"
import {
  applyMarkupToTradeLines,
  updateQuoteLine,
  updateQuoteTradeMarkup,
} from "@/lib/data/projects-store"
import { getDefaultTradeMarkups } from "@/lib/app-settings"
import {
  getLineMarkupPercent,
  hasCustomMarkup,
  isLineCosted,
  lineCostTotal,
  lineSellTotal,
  quoteCostTotals,
  quoteSellTotals,
} from "@/lib/quote-pricing"
import { getTradeLabel } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
  getLineSectionNumber,
} from "@/lib/quote-line-display"
import { QuoteTableFooterSummary } from "@/components/projektek/quote-table-footer-summary"
import { unitMap } from "@/lib/data/units-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type QuoteMarkupPanelProps = {
  quoteId: string
  quote: Quote
  lines: QuoteLine[]
  displayLines: QuoteLine[]
  quoteTrade: Trade
  readOnly?: boolean
  onRefresh: () => void
}

const numericInputNoSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"

function PctInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      className={cn("h-7 w-12 text-center text-xs tabular-nums", numericInputNoSpinner, className)}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function MarkupPercentInput({
  lineId,
  effective,
  tradeBase,
  custom,
  marginLow,
  onCommit,
}: {
  lineId: string
  effective: number
  tradeBase: number
  custom: boolean
  marginLow: boolean
  onCommit: (pct: number) => void
}) {
  const [draft, setDraft] = useState(String(effective))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(effective))
  }, [effective, focused, lineId])

  const commit = () => {
    const num = Number(draft.replace(",", "."))
    if (Number.isFinite(num) && num >= 0) {
      onCommit(num)
    } else {
      setDraft(String(effective))
    }
    setFocused(false)
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Input
        type="text"
        inputMode="numeric"
        className={cn(
          "h-7 w-11 text-right text-xs tabular-nums",
          numericInputNoSpinner,
          custom ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50",
          marginLow && "border-amber-300 bg-amber-50"
        )}
        value={draft}
        title={custom ? `Egyedi (alap: ${tradeBase}%)` : `Szakági alap: ${tradeBase}%`}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === "Escape") {
            setDraft(String(effective))
            e.currentTarget.blur()
          }
        }}
      />
      <span className="text-xs text-slate-500">%</span>
      {custom ? (
        <button
          type="button"
          className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
          title={`Vissza alapra (${tradeBase}%)`}
          onClick={() => onCommit(tradeBase)}
        >
          ↺
        </button>
      ) : null}
    </div>
  )
}

function lineMargin(line: QuoteLine, quote: Quote): { margin: number; percent: number | null } {
  if (!isLineCosted(line)) return { margin: 0, percent: null }
  const cost = lineCostTotal(line)
  const sell = lineSellTotal(line, quote)
  const margin = sell - cost
  const percent = cost > 0 ? Math.round((margin / cost) * 100) : null
  return { margin, percent }
}

export function QuoteMarkupPanel({
  quoteId,
  quote,
  lines,
  displayLines,
  quoteTrade,
  readOnly = false,
  onRefresh,
}: QuoteMarkupPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPct, setBulkPct] = useState("15")
  const [tradeBulkPct, setTradeBulkPct] = useState("")
  const [showCustomOnly, setShowCustomOnly] = useState(false)

  const tradeDefault =
    quote.tradeMarkups?.[quoteTrade] ?? getDefaultTradeMarkups()[quoteTrade]

  const filteredLines = useMemo(() => {
    if (!showCustomOnly) return displayLines
    return displayLines.filter((l) => hasCustomMarkup(l))
  }, [displayLines, showCustomOnly])

  const displayTotals = useMemo(() => {
    const cost = quoteCostTotals(displayLines)
    const sell = quoteSellTotals(displayLines, quote)
    const margin = sell.total - cost.total
    return {
      cost,
      sell,
      margin,
      marginPercent: cost.total > 0 ? Math.round((margin / cost.total) * 100) : null,
    }
  }, [displayLines, quote])

  const customCount = useMemo(
    () => lines.filter((l) => hasCustomMarkup(l) && isLineCosted(l)).length,
    [lines]
  )

  const costItemById = useMemo(() => buildCostItemMap(loadCostItems()), [])
  const sectionNumbers = useMemo(() => buildLineSectionNumbers(lines), [lines])

  const allVisibleSelected =
    filteredLines.length > 0 && filteredLines.every((l) => selected.has(l.id))

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredLines.forEach((l) => next.delete(l.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredLines.forEach((l) => {
          if (isLineCosted(l)) next.add(l.id)
        })
        return next
      })
    }
  }

  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyMarkupToLine = (line: QuoteLine, pct: number, refreshNow = true) => {
    const tradeBase = quote.tradeMarkups?.[line.trade] ?? getDefaultTradeMarkups()[line.trade]
    updateQuoteLine(line.id, {
      markupPercent: pct === tradeBase ? null : Math.max(0, pct),
    })
    if (refreshNow) onRefresh()
  }

  const applyBulkToSelected = () => {
    const pct = Number(bulkPct)
    if (!Number.isFinite(pct) || selected.size === 0) return
    let count = 0
    for (const id of selected) {
      const line = lines.find((l) => l.id === id)
      if (!line || !isLineCosted(line)) continue
      applyMarkupToLine(line, pct, false)
      count += 1
    }
    onRefresh()
    toast.success(`${count} tétel → ${pct}%`)
    setSelected(new Set())
  }

  const applyBulkToTrade = () => {
    const pct = Number(tradeBulkPct || tradeDefault)
    if (!Number.isFinite(pct)) return
    updateQuoteTradeMarkup(quoteId, quoteTrade, pct)
    const n = applyMarkupToTradeLines(quoteId, quoteTrade, pct)
    onRefresh()
    toast.success(`${getTradeLabel(quoteTrade)}: ${n} tétel → ${pct}%`)
    setTradeBulkPct("")
  }

  if (lines.length === 0) {
    return (
      <p className="rounded-lg border bg-white p-8 text-center text-sm text-slate-600">
        Előbb adj hozzá tételeket a Bekerülés tabon.
      </p>
    )
  }

  const footerLabel = "Összesen"

  const marginLow =
    displayTotals.marginPercent != null &&
    displayTotals.marginPercent < getMinAcceptableMarginPercent()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {readOnly ? (
        <div className="mb-2 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Szerződött fedezet — nem módosítható. Az ügyfél ár csak új árajánlattal változtatható.
        </div>
      ) : null}
      <div className="mb-1 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600">Alap fedezet</span>
          <PctInput
            value={tradeBulkPct}
            onChange={setTradeBulkPct}
            placeholder={String(tradeDefault)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={readOnly}
            onClick={applyBulkToTrade}
          >
            Alkalmaz
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600">Kijelöltek</span>
          <PctInput value={bulkPct} onChange={setBulkPct} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={readOnly || selected.size === 0}
            onClick={applyBulkToSelected}
          >
            Alkalmaz ({selected.size})
          </Button>
        </div>
        <Button
          type="button"
          variant={showCustomOnly ? "secondary" : "outline"}
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => setShowCustomOnly((v) => !v)}
        >
          {showCustomOnly ? "Összes" : `Egyedi (${customCount})`}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[780px] text-xs">
            <thead className="ea-table-head sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="w-8 px-1.5 py-1.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Összes kijelölése"
                  />
                </th>
                <th className="px-2 py-1.5">Ssz.</th>
                <th className="px-2 py-1.5">Tételszám</th>
                <th className="min-w-[10rem] px-2 py-1.5">Leírás</th>
                <th className="px-2 py-1.5 text-right">Menny.</th>
                <th className="px-2 py-1.5 text-right">Bekerülés</th>
                <th className="px-2 py-1.5 text-right">Fedezet %</th>
                <th className="px-2 py-1.5 text-right">Ügyfél ár</th>
                <th className="px-2 py-1.5 text-right">Fedezet összeg</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => {
                const costed = isLineCosted(line)
                const custom = hasCustomMarkup(line)
                const internalId = getLineInternalIdentifier(line, costItemById)
                const effective = getLineMarkupPercent(line, quote)
                const tradeBase =
                  quote.tradeMarkups?.[line.trade] ?? getDefaultTradeMarkups()[line.trade]
                const sell = lineSellTotal(line, quote)
                const cost = lineCostTotal(line)
                const { margin, percent } = lineMargin(line, quote)
                const rowMarginLow =
                  percent != null && percent < getMinAcceptableMarginPercent()

                return (
                  <tr
                    key={line.id}
                    className={cn(
                      "border-b hover:bg-slate-50/80 [&_td]:align-top",
                      !costed && "bg-amber-50/40",
                      rowMarginLow && costed && "bg-amber-50/15"
                    )}
                  >
                    <td className="px-1.5 py-1.5">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300"
                        checked={selected.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                        disabled={!costed}
                        aria-label={`Kijelölés: ${internalId}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-code text-slate-600">
                      {getLineSectionNumber(line.id, sectionNumbers)}
                    </td>
                    <td className="px-2 py-1.5 font-code font-medium text-blue-700">
                      {internalId}
                    </td>
                    <td className="max-w-md px-2 py-1.5">
                      <span className="block whitespace-normal break-words leading-snug text-slate-900">
                        {line.textSnapshot}
                      </span>
                      {!costed ? (
                        <span className="text-amber-800">árazatlan</span>
                      ) : custom ? (
                        <span className="text-blue-700">egyedi</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                      {line.quantity} {unitMap[line.unitId]?.code}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                      {costed ? formatHuf(cost) : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      {costed ? (
                        readOnly ? (
                          <span className="block text-right text-xs tabular-nums text-slate-700">
                            {effective}%
                          </span>
                        ) : (
                          <MarkupPercentInput
                            lineId={line.id}
                            effective={effective}
                            tradeBase={tradeBase}
                            custom={custom}
                            marginLow={rowMarginLow}
                            onCommit={(pct) => applyMarkupToLine(line, pct)}
                          />
                        )
                      ) : (
                        <span className="block text-right text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums text-blue-900">
                      {costed ? formatHuf(sell) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {costed ? (
                        <span
                          className={cn(
                            "font-medium",
                            rowMarginLow ? "text-amber-800" : "text-emerald-800"
                          )}
                        >
                          +{formatHuf(margin)}
                          {percent != null ? (
                            <span className="ml-1 font-normal text-slate-500">({percent}%)</span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredLines.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {showCustomOnly ? (
                <p>Nincs egyedi fedezetű tétel.</p>
              ) : (
                <p>Nincs megjeleníthető tétel.</p>
              )}
            </div>
          ) : null}
        </div>

        {filteredLines.length > 0 ? (
          <QuoteTableFooterSummary
            label={footerLabel}
            cells={[
              {
                label: "Bekerülés",
                value: formatHuf(displayTotals.cost.total),
                tone: "cost",
                emphasis: true,
              },
              {
                label: "Ügyfél ár",
                value: formatHuf(displayTotals.sell.total),
                tone: "blue",
                emphasis: true,
              },
              {
                label: "Fedezet",
                value: formatHuf(displayTotals.margin),
                tone: marginLow ? "amber" : "emerald",
                emphasis: true,
                suffix:
                  displayTotals.marginPercent != null
                    ? `(${displayTotals.marginPercent}%)`
                    : undefined,
              },
            ]}
          />
        ) : null}
      </div>
    </div>
  )
}
