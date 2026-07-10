"use client"

import { useMemo, useRef, useState } from "react"
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
import { calcQuoteVatTotals, resolveQuoteVatMode } from "@/lib/quote-client-summary"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { groupLinesByTrade } from "@/lib/quote-utils"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
  getLineSectionNumber,
} from "@/lib/quote-line-display"
import { SpreadsheetNumberCell } from "@/components/projektek/spreadsheet/spreadsheet-number-cell"
import { MarkupSheetColgroup } from "@/components/projektek/spreadsheet/markup-sheet-colgroup"
import {
  SheetFooterLabelCell,
  SheetHeaderCell,
  SpreadsheetReadonlyCell,
} from "@/components/projektek/spreadsheet/spreadsheet-readonly-cell"
import { MARKUP_SHEET_COLS } from "@/lib/quote-spreadsheet"
import {
  MARKUP_SHEET_FOOTER,
  MARKUP_SHEET_HEADERS,
  MARKUP_SHEET_MIN_WIDTH,
} from "@/lib/quote-sheet-layout"
import type { SheetDensity } from "@/lib/quote-sheet-layout"
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
  excelMode?: boolean
  sheetDensity?: SheetDensity
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
  excelMode = false,
  sheetDensity = "compact",
  onRefresh,
}: QuoteMarkupPanelProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [activeRow, setActiveRow] = useState<number | null>(null)
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

  const vatMode = resolveQuoteVatMode(quote)
  const vatTotals = useMemo(
    () => calcQuoteVatTotals(displayTotals.sell.total, vatMode),
    [displayTotals.sell.total, vatMode]
  )

  const customCount = useMemo(
    () => lines.filter((l) => hasCustomMarkup(l) && isLineCosted(l)).length,
    [lines]
  )

  const costItemById = useMemo(() => buildCostItemMap(loadCostItems()), [])
  const sectionNumbers = useMemo(() => buildLineSectionNumbers(lines), [lines])

  const sheetRows = useMemo(() => {
    const grouped = groupLinesByTrade(filteredLines)
    const rows: Array<
      | { kind: "section"; trade: Trade; lineCount: number }
      | { kind: "line"; line: QuoteLine; sheetRow: number }
    > = []
    let sheetRow = 0
    for (const [trade, group] of grouped) {
      rows.push({ kind: "section", trade, lineCount: group.length })
      for (const line of group) {
        rows.push({ kind: "line", line, sheetRow })
        sheetRow += 1
      }
    }
    return rows
  }, [filteredLines])

  const maxMarkupRow = Math.max(
    0,
    sheetRows.filter((r) => r.kind === "line").length - 1
  )

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

  const footerLabel = MARKUP_SHEET_FOOTER.label

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

      <div
        className={cn(
          "ea-worksheet ea-worksheet-markup flex min-h-0 flex-1 flex-col overflow-hidden border border-[#b4b4b4] bg-white",
          sheetDensity === "normal" && "ea-worksheet-density-normal",
          excelMode && "ea-worksheet-max"
        )}
      >
        <div ref={gridRef} className="min-h-0 flex-1 overflow-auto">
          <table
            className="ea-worksheet-table text-xs"
            style={{ minWidth: MARKUP_SHEET_MIN_WIDTH }}
          >
            <MarkupSheetColgroup />
            <thead className="ea-worksheet-head">
              <tr>
                <SheetHeaderCell
                  label=""
                  className="px-1"
                  children={
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Összes kijelölése"
                    />
                  }
                />
                <SheetHeaderCell label="Ssz." className="ea-freeze-col ea-freeze-0" />
                <SheetHeaderCell label="Tételszám" className="ea-freeze-col ea-freeze-1" nowrap />
                <SheetHeaderCell label="Leírás" className="ea-freeze-col ea-freeze-2" />
                <SheetHeaderCell
                  label={MARKUP_SHEET_HEADERS.quantity.short}
                  title={MARKUP_SHEET_HEADERS.quantity.full}
                  align="right"
                />
                <SheetHeaderCell
                  label={MARKUP_SHEET_HEADERS.cost.short}
                  sub={MARKUP_SHEET_HEADERS.cost.sub}
                  title={MARKUP_SHEET_HEADERS.cost.full}
                  align="right"
                  nowrap
                />
                <SheetHeaderCell
                  label={MARKUP_SHEET_HEADERS.markup.short}
                  title={MARKUP_SHEET_HEADERS.markup.full}
                  editable
                  align="right"
                  nowrap
                  className="ea-sheet-zone-end"
                  colActive={activeRow !== null}
                />
                <SheetHeaderCell
                  label={MARKUP_SHEET_HEADERS.sell.short}
                  sub={MARKUP_SHEET_HEADERS.sell.sub}
                  title={MARKUP_SHEET_HEADERS.sell.full}
                  align="right"
                  nowrap
                />
                <SheetHeaderCell
                  label={MARKUP_SHEET_HEADERS.margin.short}
                  sub={MARKUP_SHEET_HEADERS.margin.sub}
                  title={MARKUP_SHEET_HEADERS.margin.full}
                  align="right"
                  nowrap
                />
              </tr>
            </thead>
            <tbody>
              {sheetRows.map((row) => {
                if (row.kind === "section") {
                  return (
                    <tr key={`section-${row.trade}`} className="ea-worksheet-section">
                      <td colSpan={9} className="font-semibold">
                        {getTradeLabel(row.trade)} ({row.lineCount} tétel)
                      </td>
                    </tr>
                  )
                }

                const line = row.line
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
                      "group/row",
                      !costed && "bg-amber-50/40",
                      rowMarginLow && costed && "bg-amber-50/15",
                      activeRow === row.sheetRow && "ea-worksheet-row-active",
                      row.sheetRow % 2 === 1 && "ea-worksheet-zebra"
                    )}
                  >
                    <td className="px-1 text-center">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300"
                        checked={selected.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                        disabled={!costed}
                        aria-label={`Kijelölés: ${internalId}`}
                      />
                    </td>
                    <td className="ea-freeze-col ea-freeze-0">
                      <SpreadsheetReadonlyCell
                        value={getLineSectionNumber(line.id, sectionNumbers)}
                        variant="meta"
                        align="left"
                        className="font-code text-slate-600"
                      />
                    </td>
                    <td className="ea-freeze-col ea-freeze-1">
                      <SpreadsheetReadonlyCell
                        value={internalId}
                        variant="meta"
                        align="left"
                        className="whitespace-nowrap font-code font-medium text-blue-700"
                        title={internalId}
                      />
                    </td>
                    <td className="ea-freeze-col ea-freeze-2">
                      <SpreadsheetReadonlyCell
                        value={
                          <>
                            <span className="whitespace-normal break-words leading-snug text-slate-900">
                              {line.textSnapshot}
                            </span>
                            {!costed ? (
                              <span className="text-amber-800"> árazatlan</span>
                            ) : custom ? (
                              <span className="text-blue-700"> egyedi</span>
                            ) : null}
                          </>
                        }
                        variant="meta"
                        align="left"
                      />
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={`${line.quantity} ${unitMap[line.unitId]?.code ?? ""}`}
                        variant="computed"
                        title="Mennyiség és mértékegység"
                        truncate
                      />
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={costed ? formatHuf(cost) : "—"}
                        variant="computed"
                        title="Számított bekerülési összeg"
                      />
                    </td>
                    <td
                      className={cn(
                        "ea-sheet-editable",
                        activeRow === row.sheetRow && "ea-sheet-cell-active ea-sheet-zone-end"
                      )}
                    >
                      {costed ? (
                        readOnly ? (
                          <SpreadsheetReadonlyCell
                            value={`${effective}%`}
                            variant="locked_quote"
                            title="Szerződött fedezet — nem módosítható"
                          />
                        ) : (
                          <div className="flex items-center justify-end gap-0.5 pr-1">
                            <SpreadsheetNumberCell
                              value={effective}
                              sheetRow={row.sheetRow}
                              sheetCol="markup"
                              maxRow={maxMarkupRow}
                              cols={MARKUP_SHEET_COLS}
                              gridRootRef={gridRef}
                              active={activeRow === row.sheetRow}
                              onActivate={(r) => setActiveRow(r)}
                              onChange={(pct) => applyMarkupToLine(line, pct)}
                              className={cn(
                                custom && "bg-blue-50",
                                rowMarginLow && "bg-amber-50"
                              )}
                            />
                            <span className="text-xs text-slate-500">%</span>
                            {custom ? (
                              <button
                                type="button"
                                className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
                                title={`Vissza alapra (${tradeBase}%)`}
                                onClick={() => applyMarkupToLine(line, tradeBase)}
                              >
                                ↺
                              </button>
                            ) : null}
                          </div>
                        )
                      ) : (
                        <SpreadsheetReadonlyCell value="—" variant="computed" />
                      )}
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={costed ? formatHuf(sell) : "—"}
                        variant="computed"
                        className="font-medium text-blue-900"
                        title="Számított ügyfél ár"
                      />
                    </td>
                    <td>
                      {costed ? (
                        <SpreadsheetReadonlyCell
                          value={
                            <>
                              +{formatHuf(margin)}
                              {percent != null ? (
                                <span className="ml-1 font-normal text-slate-500">({percent}%)</span>
                              ) : null}
                            </>
                          }
                          variant="computed"
                          className={cn(
                            "font-medium",
                            rowMarginLow ? "text-amber-800" : "text-emerald-800"
                          )}
                          title="Számított fedezet összeg"
                        />
                      ) : (
                        <SpreadsheetReadonlyCell value="—" variant="computed" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filteredLines.length > 0 ? (
              <tfoot className="ea-worksheet-foot">
                <tr>
                  <SheetFooterLabelCell
                    label={footerLabel}
                    sub={MARKUP_SHEET_FOOTER.sub}
                    colSpan={5}
                  />
                  <td>
                    <SpreadsheetReadonlyCell
                      value={formatHuf(displayTotals.cost.total)}
                      variant="computed"
                      className="font-bold"
                      title="Nettó bekerülés összesen"
                    />
                  </td>
                  <td>
                    <SpreadsheetReadonlyCell
                      value={
                        displayTotals.marginPercent != null
                          ? `${displayTotals.marginPercent}%`
                          : "—"
                      }
                      variant="computed"
                      title="Átlagos fedezet %"
                    />
                  </td>
                  <td>
                    <SpreadsheetReadonlyCell
                      value={formatHuf(displayTotals.sell.total)}
                      variant="computed"
                      className="font-bold text-blue-900"
                      title="Nettó ügyfél ár összesen"
                    />
                  </td>
                  <td>
                    <SpreadsheetReadonlyCell
                      value={`+${formatHuf(displayTotals.margin)}`}
                      variant="computed"
                      className="font-bold text-emerald-900"
                      title="Nettó fedezet összesen"
                    />
                  </td>
                </tr>
                {vatTotals.vatAmount > 0 ? (
                  <tr className="ea-worksheet-foot">
                    <SheetFooterLabelCell
                      label={vatTotals.vatLabel}
                      sub="ÁFA"
                      colSpan={7}
                    />
                    <td>
                      <SpreadsheetReadonlyCell
                        value={formatHuf(vatTotals.vatAmount)}
                        variant="computed"
                        className="font-medium text-amber-900"
                        title="ÁFA összeg"
                      />
                    </td>
                    <td colSpan={1} />
                  </tr>
                ) : null}
                <tr className="ea-worksheet-foot">
                  <SheetFooterLabelCell
                    label="Bruttó"
                    sub={
                      vatMode === "aam"
                        ? "ÁFA mentes (AAM)"
                        : vatMode === "reverse_charge"
                          ? "fordított adózás"
                          : vatTotals.vatAmount > 0
                            ? "ügyfélnek · ÁFA-val"
                            : "ügyfél ár"
                    }
                    colSpan={7}
                  />
                  <td>
                    <SpreadsheetReadonlyCell
                      value={formatHuf(vatTotals.grossTotal)}
                      variant="computed"
                      className="font-bold text-blue-900"
                      title="Bruttó ügyfél ár összesen"
                    />
                  </td>
                  <td colSpan={1} />
                </tr>
              </tfoot>
            ) : null}
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
          <p className="shrink-0 border-t border-[#d4d4d4] bg-[#f3f3f3] px-2 py-1 text-[10px] text-slate-600">
            Fehér = szerkeszthető fedezet % · Szürke = számított · Enter / Tab: következő cella
          </p>
        ) : null}
      </div>
    </div>
  )
}
