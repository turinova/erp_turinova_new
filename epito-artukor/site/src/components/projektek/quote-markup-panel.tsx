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
import {
  MARGIN_LEGEND,
  marginInputToneClass,
  marginResultToneClass,
  marginStatusBadgeClass,
  marginStatusLabel,
  marginTdToneClass,
  marginToneTitle,
  resolveMarginToneBand,
} from "@/lib/quote-margin-tone"
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

type LineFilter = "all" | "low" | "custom"

const COL_COUNT = 8

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
      className={cn(
        "h-9 w-16 text-center text-sm font-semibold tabular-nums",
        numericInputNoSpinner,
        className
      )}
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

function isLowMarginLine(line: QuoteLine, quote: Quote): boolean {
  if (!isLineCosted(line)) return false
  const { percent } = lineMargin(line, quote)
  const band = resolveMarginToneBand(percent)
  return band === "critical" || band === "tight"
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
  const gridRef = useRef<HTMLDivElement>(null)
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPct, setBulkPct] = useState("15")
  const [tradeBulkPct, setTradeBulkPct] = useState("")
  const [lineFilter, setLineFilter] = useState<LineFilter>("all")

  const minMargin = getMinAcceptableMarginPercent()
  const tradeDefault =
    quote.tradeMarkups?.[quoteTrade] ?? getDefaultTradeMarkups()[quoteTrade]

  const lowCount = useMemo(
    () => displayLines.filter((l) => isLowMarginLine(l, quote)).length,
    [displayLines, quote]
  )

  const customCount = useMemo(
    () => lines.filter((l) => hasCustomMarkup(l) && isLineCosted(l)).length,
    [lines]
  )

  const unpricedCount = useMemo(
    () => displayLines.filter((l) => !isLineCosted(l)).length,
    [displayLines]
  )

  const filteredLines = useMemo(() => {
    if (lineFilter === "low") {
      return displayLines.filter((l) => isLowMarginLine(l, quote))
    }
    if (lineFilter === "custom") {
      return displayLines.filter((l) => hasCustomMarkup(l))
    }
    return displayLines
  }, [displayLines, lineFilter, quote])

  const displayTotals = useMemo(() => {
    const cost = quoteCostTotals(displayLines)
    const sell = quoteSellTotals(displayLines, quote)
    const margin = sell.total - cost.total
    const marginPercent = cost.total > 0 ? Math.round((margin / cost.total) * 100) : null
    return {
      cost,
      sell,
      margin,
      marginPercent,
      marginBand: resolveMarginToneBand(marginPercent),
    }
  }, [displayLines, quote])

  const vatMode = resolveQuoteVatMode(quote)
  const vatTotals = useMemo(
    () => calcQuoteVatTotals(displayTotals.sell.total, vatMode),
    [displayTotals.sell.total, vatMode]
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
      if (grouped.size > 1) {
        rows.push({ kind: "section", trade, lineCount: group.length })
      }
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

  const costedVisible = useMemo(
    () => filteredLines.filter((l) => isLineCosted(l)),
    [filteredLines]
  )

  const allVisibleSelected =
    costedVisible.length > 0 && costedVisible.every((l) => selected.has(l.id))

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        costedVisible.forEach((l) => next.delete(l.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        costedVisible.forEach((l) => next.add(l.id))
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
      <p className="rounded-lg border bg-white p-8 text-center text-base text-slate-600">
        Előbb adj hozzá tételeket a <strong>Bekerülés</strong> fülön.
      </p>
    )
  }

  const heroBand = displayTotals.marginBand
  const statusText =
    unpricedCount > 0 && heroBand == null
      ? `${unpricedCount} tétel még nincs beárazva`
      : unpricedCount > 0
        ? `${marginStatusLabel(heroBand)} · ${unpricedCount} árazatlan`
        : marginStatusLabel(heroBand)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Hero — Marad nekem */}
      <div
        className={cn(
          "shrink-0 rounded-lg border px-4 py-3 shadow-sm",
          heroBand === "critical" && "border-red-200 bg-red-50/80",
          heroBand === "tight" && "border-amber-200 bg-amber-50/80",
          heroBand === "ok" && "border-emerald-200 bg-emerald-50/70",
          heroBand === "strong" && "border-emerald-300 bg-emerald-100/80",
          !heroBand && "border-slate-200 bg-white"
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600">Marad nekem</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-950">
                {formatHuf(displayTotals.margin)}
              </span>
              {displayTotals.marginPercent != null ? (
                <span className="text-lg font-semibold tabular-nums text-slate-700">
                  ({displayTotals.marginPercent}%)
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Cél: min. <strong className="tabular-nums">{minMargin}%</strong>
              {unpricedCount > 0 ? (
                <span className="text-amber-800">
                  {" "}
                  · {unpricedCount} tételnek még nincs bekerülési ára
                </span>
              ) : null}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-semibold",
              marginStatusBadgeClass(heroBand)
            )}
          >
            {statusText}
          </span>
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-black/5 pt-2.5">
          {MARGIN_LEGEND.map((item) => (
            <li key={item.band} className="flex items-center gap-1.5 text-sm text-slate-700">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", item.swatch)} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {readOnly ? (
        <div className="shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800">
          <strong>Szerződéses ár — nem változtatható.</strong> Használd a felső sávot: új árajánlat
          az ügyfélnek, vagy pótmunka.
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-medium text-slate-800">Egész szakágra</span>
          <PctInput
            value={tradeBulkPct}
            onChange={setTradeBulkPct}
            placeholder={String(tradeDefault)}
            className="border-slate-300"
          />
          <span className="text-sm text-slate-500">%</span>
          <Button
            type="button"
            size="sm"
            className="h-9 px-3 text-sm"
            disabled={readOnly}
            onClick={applyBulkToTrade}
          >
            Beállítás
          </Button>
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
            <span className="text-sm font-medium text-blue-950">
              Kijelöltek ({selected.size})
            </span>
            <PctInput value={bulkPct} onChange={setBulkPct} className="border-blue-200 bg-white" />
            <span className="text-sm text-slate-500">%</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 px-3 text-sm"
              disabled={readOnly}
              onClick={applyBulkToSelected}
            >
              Alkalmaz
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          variant={lineFilter === "low" ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-9 px-3 text-sm",
            lineFilter !== "low" && lowCount > 0 && "border-amber-300 text-amber-950"
          )}
          disabled={lowCount === 0 && lineFilter !== "low"}
          onClick={() => setLineFilter((f) => (f === "low" ? "all" : "low"))}
        >
          Alacsony fedezet ({lowCount})
        </Button>

        {customCount > 0 ? (
          <Button
            type="button"
            variant={lineFilter === "custom" ? "secondary" : "outline"}
            size="sm"
            className="h-9 px-3 text-sm"
            onClick={() => setLineFilter((f) => (f === "custom" ? "all" : "custom"))}
          >
            {lineFilter === "custom" ? "Összes tétel" : `Ahol mást írtam (${customCount})`}
          </Button>
        ) : null}
      </div>

      <div className="ea-worksheet ea-worksheet-markup flex min-h-0 flex-1 flex-col overflow-hidden border border-[#b4b4b4] bg-white">
        <div ref={gridRef} className="min-h-0 flex-1 overflow-auto">
          <table
            className="ea-worksheet-table text-sm"
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
                      className="h-5 w-5 rounded border-slate-400"
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
                      <td colSpan={COL_COUNT} className="font-semibold">
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
                const sell = lineSellTotal(line, quote)
                const cost = lineCostTotal(line)
                const { margin, percent } = lineMargin(line, quote)
                const marginBand = costed ? resolveMarginToneBand(percent) : null
                const unitLabel = unitMap[line.unitId]?.code ?? ""

                return (
                  <tr
                    key={line.id}
                    className={cn(
                      "group/row",
                      !costed && "bg-amber-50/50",
                      activeRow === row.sheetRow && "ea-worksheet-row-active",
                      row.sheetRow % 2 === 1 && "ea-worksheet-zebra"
                    )}
                  >
                    <td className="px-1 text-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-slate-400"
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
                        className="font-code font-semibold text-slate-700"
                      />
                    </td>
                    <td className="ea-freeze-col ea-freeze-1">
                      <SpreadsheetReadonlyCell
                        value={internalId}
                        variant="meta"
                        align="left"
                        className="whitespace-nowrap font-code font-semibold text-blue-800"
                        title={internalId}
                      />
                    </td>
                    <td className="ea-freeze-col ea-freeze-2">
                      <SpreadsheetReadonlyCell
                        value={
                          <>
                            <span className="block whitespace-normal break-words leading-snug text-slate-900">
                              {line.textSnapshot}
                            </span>
                            <span className="mt-0.5 block text-[13px] tabular-nums text-slate-600">
                              {line.quantity} {unitLabel}
                              {!costed ? (
                                <span className="font-semibold text-amber-800">
                                  {" "}
                                  · Nincs bekerülés — előbb a Bekerülés fül
                                </span>
                              ) : custom ? (
                                <span className="text-blue-700"> · egyedi kulcs</span>
                              ) : null}
                            </span>
                          </>
                        }
                        variant="meta"
                        align="left"
                      />
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={costed ? formatHuf(cost) : "—"}
                        variant="computed"
                        title="Bekerülési összeg"
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
                            title={
                              marginToneTitle(marginBand, minMargin) ??
                              "Szerződéses ráterhelés — nem módosítható"
                            }
                            className={cn("!bg-transparent", marginResultToneClass(marginBand))}
                          />
                        ) : (
                          <div className="flex min-w-0 items-center justify-end gap-0.5 px-1">
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
                              title={marginToneTitle(marginBand, minMargin)}
                              className={cn(
                                "min-w-0 flex-1",
                                marginInputToneClass(marginBand),
                                custom && !marginBand && "bg-blue-50"
                              )}
                            />
                            <span className="shrink-0 text-sm text-slate-500">%</span>
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
                        title="Ügyfél ár"
                      />
                    </td>
                    <td className={marginTdToneClass(marginBand)}>
                      {costed ? (
                        <SpreadsheetReadonlyCell
                          value={
                            <>
                              +{formatHuf(margin)}
                              {percent != null ? (
                                <span className="ml-1 font-normal opacity-80">({percent}%)</span>
                              ) : null}
                            </>
                          }
                          variant="computed"
                          className={cn("!bg-transparent", marginResultToneClass(marginBand))}
                          title={
                            marginToneTitle(marginBand, minMargin) ?? "Marad nekem"
                          }
                        />
                      ) : (
                        <SpreadsheetReadonlyCell value="—" variant="computed" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filteredLines.length > 0 && lineFilter === "all" ? (
              <tfoot className="ea-worksheet-foot">
                <tr>
                  <SheetFooterLabelCell
                    label={MARKUP_SHEET_FOOTER.label}
                    sub={MARKUP_SHEET_FOOTER.sub}
                    colSpan={4}
                  />
                  <td>
                    <SpreadsheetReadonlyCell
                      value={formatHuf(displayTotals.cost.total)}
                      variant="computed"
                      className="font-bold"
                      title="Nettó bekerülés összesen"
                    />
                  </td>
                  <td className={marginTdToneClass(displayTotals.marginBand)}>
                    <SpreadsheetReadonlyCell
                      value={
                        displayTotals.marginPercent != null
                          ? `${displayTotals.marginPercent}%`
                          : "—"
                      }
                      variant="computed"
                      className={cn(
                        "!bg-transparent font-bold",
                        marginResultToneClass(displayTotals.marginBand)
                      )}
                      title="Átlagos ráterhelés / fedezet %"
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
                  <td className={marginTdToneClass(displayTotals.marginBand)}>
                    <SpreadsheetReadonlyCell
                      value={`+${formatHuf(displayTotals.margin)}`}
                      variant="computed"
                      className={cn(
                        "!bg-transparent font-bold",
                        marginResultToneClass(displayTotals.marginBand)
                      )}
                      title="Marad nekem összesen"
                    />
                  </td>
                </tr>
                {vatTotals.vatAmount > 0 ? (
                  <tr className="ea-worksheet-foot">
                    <SheetFooterLabelCell
                      label={vatTotals.vatLabel}
                      sub="ÁFA"
                      colSpan={6}
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
                    label="Bruttó ügyfélnek"
                    sub={
                      vatMode === "aam"
                        ? "ÁFA mentes (AAM)"
                        : vatMode === "reverse_charge"
                          ? "fordított adózás"
                          : vatTotals.vatAmount > 0
                            ? "ÁFA-val"
                            : "ügyfél ár"
                    }
                    colSpan={6}
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
            <div className="p-8 text-center text-base text-slate-600">
              {lineFilter === "low" ? (
                <p>Nincs alacsony fedezetű tétel — minden rendben.</p>
              ) : lineFilter === "custom" ? (
                <p>Nincs olyan tétel, ahol egyedi kulcsot írtál be.</p>
              ) : (
                <p>Nincs megjeleníthető tétel.</p>
              )}
            </div>
          ) : null}
        </div>

        <p className="shrink-0 border-t border-[#d4d4d4] bg-[#f8fafc] px-3 py-2 text-sm text-slate-600">
          <strong className="font-semibold text-slate-800">Ráterhelés %</strong> = amit beírsz ·{" "}
          <strong className="font-semibold text-slate-800">Marad nekem</strong> = amennyi ténylegesen
          megmarad · Enter / Tab: következő sor
        </p>
      </div>
    </div>
  )
}
