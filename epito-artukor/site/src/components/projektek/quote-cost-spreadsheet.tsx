"use client"

import { Fragment, useCallback, useMemo, useRef, useState } from "react"
import { BookOpen, Hand, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { CostItem } from "@/types"
import type { Quote, QuoteLine } from "@/types/projects"
import type { Trade } from "@/types"
import {
  COST_SHEET_FOOTER,
  COST_SHEET_HEADERS,
  COST_SHEET_MIN_WIDTH,
  type SheetDensity,
} from "@/lib/quote-sheet-layout"
import {
  costFieldLockTitle,
  isCostFieldDisabled,
} from "@/lib/quote-sheet-editability"
import {
  groupLinesByTrade,
  lineCostLaborTotal,
  lineCostMaterialTotal,
  lineCostTotal,
  quoteCostTotals,
} from "@/lib/quote-utils"
import {
  applyCostPasteToLines,
  COST_SHEET_COLS,
  type CostSheetCol,
  focusSheetCell,
} from "@/lib/quote-spreadsheet"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
  getLineSectionNumber,
} from "@/lib/quote-line-display"
import {
  convertQuoteLineToManualCost,
  deleteQuoteLine,
  getSubmission,
  updateQuoteLine,
} from "@/lib/data/projects-store"
import { getQuoteLineRfqContexts } from "@/lib/quote-rfq-context"
import { getTradeLabel } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"
import { loadUnits, unitMap } from "@/lib/data/units-store"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CostSourceLegend,
  getQuoteLineRowClass,
  getQuoteLineVisualKind,
  QuoteLineSourceIcon,
  subcontractorPriceInputClass,
} from "@/lib/quote-line-visual"
import { QuoteLineBidExpandRow, lineHasRfqBids } from "@/components/projektek/quote-line-bid-expand"
import { CostSheetColgroup } from "@/components/projektek/spreadsheet/cost-sheet-colgroup"
import { SpreadsheetNumberCell } from "@/components/projektek/spreadsheet/spreadsheet-number-cell"
import {
  SheetFooterLabelCell,
  SheetHeaderCell,
  SpreadsheetReadonlyCell,
} from "@/components/projektek/spreadsheet/spreadsheet-readonly-cell"
import { cn } from "@/lib/utils"

const TABLE_COLS = 12

type SheetRow =
  | { kind: "section"; trade: Trade; lineCount: number }
  | { kind: "line"; line: QuoteLine; sheetRow: number }

type QuoteCostSpreadsheetProps = {
  quoteId: string
  quote: Quote
  lines: QuoteLine[]
  displayLines: QuoteLine[]
  costItems: CostItem[]
  isReadOnly: boolean
  excelMode: boolean
  sheetDensity?: SheetDensity
  footerLabel: string
  costSourceFilterActive: boolean
  onClearFilter: () => void
  onRefresh: () => void
  onFillFromCatalog: (lineId: string, costItemId: string) => void
  onCostPriceChange: (
    line: QuoteLine,
    field: "costMaterialUnitPrice" | "costLaborUnitPrice",
    value: number
  ) => void
  expandedBidLineId: string | null
  onExpandedBidLineIdChange: (id: string | null) => void
}

function buildSheetRows(lines: QuoteLine[]): SheetRow[] {
  const grouped = groupLinesByTrade(lines)
  const rows: SheetRow[] = []
  let sheetRow = 0
  for (const [trade, group] of grouped) {
    rows.push({ kind: "section", trade, lineCount: group.length })
    for (const line of group) {
      rows.push({ kind: "line", line, sheetRow })
      sheetRow += 1
    }
  }
  return rows
}

function WorksheetUnitSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (unitId: string) => void
  disabled?: boolean
}) {
  const units = loadUnits()
  const resolved = unitMap[value] ? value : units[0]?.id ?? value

  return (
    <Select value={resolved} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="ea-sheet-input h-6 w-full max-w-full rounded-none border-0 bg-transparent px-1 text-xs shadow-none [&>span]:truncate">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {units.map((unit) => (
          <SelectItem key={unit.id} value={unit.id} className="text-xs">
            {unit.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function QuoteCostSpreadsheet({
  quoteId,
  quote: _quote,
  lines,
  displayLines,
  costItems,
  isReadOnly,
  excelMode,
  sheetDensity = "compact",
  footerLabel,
  costSourceFilterActive,
  onClearFilter,
  onRefresh,
  onFillFromCatalog,
  onCostPriceChange,
  expandedBidLineId,
  onExpandedBidLineIdChange,
}: QuoteCostSpreadsheetProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [activeCell, setActiveCell] = useState<{ row: number; col: CostSheetCol } | null>(null)

  const costItemById = useMemo(() => buildCostItemMap(costItems), [costItems])
  const sectionNumbers = useMemo(() => buildLineSectionNumbers(displayLines), [displayLines])
  const sheetRows = useMemo(() => buildSheetRows(displayLines), [displayLines])
  const lineRows = useMemo(
    () => sheetRows.filter((r): r is Extract<SheetRow, { kind: "line" }> => r.kind === "line"),
    [sheetRows]
  )
  const maxSheetRow = Math.max(0, lineRows.length - 1)
  const displayCostTotals = useMemo(() => quoteCostTotals(displayLines), [displayLines])

  const sectionSubtotals = useMemo(() => {
    const map = new Map<Trade, { material: number; labor: number; total: number }>()
    for (const [trade, group] of groupLinesByTrade(displayLines)) {
      const totals = quoteCostTotals(group)
      map.set(trade, totals)
    }
    return map
  }, [displayLines])

  const handleConvertToManual = (line: QuoteLine) => {
    const lineLabel = getLineInternalIdentifier(line, costItemById)
    const msg =
      line.costSource === "subcontractor"
        ? `„${lineLabel}” — saját kivitelezésre váltasz? Az alvállalkozói forrás törlődik, az ár megmarad kézi bevitelként.`
        : `„${lineLabel}” — kivéve a bekérésből, kézi árazásra váltasz?`
    if (!confirm(msg)) return
    convertQuoteLineToManualCost(line.id)
    onRefresh()
    toast.success("Kézi árazásra váltva")
  }

  const handleDeleteLine = (lineId: string, label: string) => {
    if (!confirm(`„${label}” törlése az árajánlatból?`)) return
    deleteQuoteLine(lineId)
    onRefresh()
    toast.success("Tétel törölve")
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (isReadOnly) return
      const text = e.clipboardData.getData("text/plain")
      if (!text.includes("\t") && !text.includes("\n")) return
      e.preventDefault()

      const startRow = activeCell?.row ?? 0
      const startCol = activeCell?.col ?? "quantity"
      const grid = text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((row) => row.trim().length > 0)
        .map((row) => row.split("\t"))

      const updated = applyCostPasteToLines(
        displayLines,
        startRow,
        startCol,
        grid,
        (lineId, patch) => {
          updateQuoteLine(lineId, patch)
        }
      )
      if (updated > 0) {
        onRefresh()
        toast.success(`${updated} sor beillesztve`)
      }
    },
    [activeCell, displayLines, isReadOnly, onRefresh]
  )

  const renderDataRow = (line: QuoteLine, sheetRow: number, rowIndex: number) => {
    const visualKind = getQuoteLineVisualKind(line)
    const submission = line.costSourceRfqSubmissionId
      ? getSubmission(line.costSourceRfqSubmissionId)
      : undefined
    const priceClass = subcontractorPriceInputClass(line)
    const showBidExpand = lineHasRfqBids(line, quoteId, lines)
    const bidExpanded = expandedBidLineId === line.id
    const rfqBidCount = getQuoteLineRfqContexts(line.id, quoteId, lines).reduce(
      (max, c) => Math.max(max, c.submissionCount),
      0
    )
    const rowActive = activeCell?.row === sheetRow
    const zebra = sheetRow % 2 === 1
    const cellActive = (col: CostSheetCol) => rowActive && activeCell?.col === col
    const internalId = getLineInternalIdentifier(line, costItemById)
    const materialLocked = isCostFieldDisabled(line, "materialUnit", isReadOnly)
    const laborLocked = isCostFieldDisabled(line, "laborUnit", isReadOnly)
    const quantityLocked = isCostFieldDisabled(line, "quantity", isReadOnly)
    const unitLocked = isCostFieldDisabled(line, "unit", isReadOnly)

    return (
      <Fragment key={line.id}>
        <tr
          className={cn(
            "group/row",
            getQuoteLineRowClass(visualKind),
            rowActive && "ea-worksheet-row-active",
            zebra && "ea-worksheet-zebra"
          )}
        >
          <td className="ea-freeze-col ea-freeze-0">
            <SpreadsheetReadonlyCell
              value={getLineSectionNumber(line.id, sectionNumbers, rowIndex + 1)}
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
              value={line.textSnapshot}
              variant="meta"
              align="left"
              className="whitespace-normal break-words leading-snug"
            />
          </td>
          <td className={cn("ea-sheet-editable", cellActive("quantity") && "ea-sheet-cell-active")}>
            <SpreadsheetNumberCell
              value={line.quantity}
              sheetRow={sheetRow}
              sheetCol="quantity"
              maxRow={maxSheetRow}
              gridRootRef={gridRef}
              active={activeCell?.row === sheetRow && activeCell.col === "quantity"}
              onActivate={(row, col) => setActiveCell({ row, col: col as CostSheetCol })}
              onChange={(v) => {
                updateQuoteLine(line.id, { quantity: v })
                onRefresh()
              }}
              disabled={quantityLocked}
              align="right"
              title={costFieldLockTitle(line, "quantity", isReadOnly)}
            />
          </td>
          <td className="ea-sheet-editable">
            <WorksheetUnitSelect
              value={line.unitId}
              disabled={unitLocked}
              onChange={(unitId) => {
                updateQuoteLine(line.id, { unitId })
                onRefresh()
              }}
            />
          </td>
          <td
            className={cn(
              "ea-sheet-editable",
              priceClass,
              cellActive("material") && "ea-sheet-cell-active"
            )}
          >
            <SpreadsheetNumberCell
              value={line.costMaterialUnitPrice}
              sheetRow={sheetRow}
              sheetCol="material"
              maxRow={maxSheetRow}
              gridRootRef={gridRef}
              active={activeCell?.row === sheetRow && activeCell.col === "material"}
              onActivate={(row, col) => setActiveCell({ row, col: col as CostSheetCol })}
              onChange={(v) => onCostPriceChange(line, "costMaterialUnitPrice", v)}
              disabled={materialLocked}
              title={costFieldLockTitle(line, "materialUnit", isReadOnly)}
            />
          </td>
          <td
            className={cn(
              "ea-sheet-editable ea-sheet-zone-end",
              priceClass,
              cellActive("labor") && "ea-sheet-cell-active"
            )}
          >
            <SpreadsheetNumberCell
              value={line.costLaborUnitPrice}
              sheetRow={sheetRow}
              sheetCol="labor"
              maxRow={maxSheetRow}
              gridRootRef={gridRef}
              active={activeCell?.row === sheetRow && activeCell.col === "labor"}
              onActivate={(row, col) => setActiveCell({ row, col: col as CostSheetCol })}
              onChange={(v) => onCostPriceChange(line, "costLaborUnitPrice", v)}
              disabled={laborLocked}
              title={costFieldLockTitle(line, "laborUnit", isReadOnly)}
            />
          </td>
          <td>
            <SpreadsheetReadonlyCell
              value={formatHuf(lineCostMaterialTotal(line))}
              variant="computed"
              title={costFieldLockTitle(line, "materialTotal", isReadOnly)}
            />
          </td>
          <td>
            <SpreadsheetReadonlyCell
              value={formatHuf(lineCostLaborTotal(line))}
              variant="computed"
              title={costFieldLockTitle(line, "laborTotal", isReadOnly)}
            />
          </td>
          <td>
            <SpreadsheetReadonlyCell
              value={formatHuf(lineCostTotal(line))}
              variant="computed"
              className="font-medium"
              title={costFieldLockTitle(line, "lineTotal", isReadOnly)}
            />
          </td>
          <td>
            <SpreadsheetReadonlyCell
              value={
                visualKind === "rfq_pending" && rfqBidCount > 0 ? (
                  <span className="font-medium text-blue-800">{rfqBidCount}</span>
                ) : (
                  <QuoteLineSourceIcon line={line} submittedAt={submission?.submittedAt} />
                )
              }
              variant="meta"
              align="center"
              title={
                visualKind === "rfq_pending" && rfqBidCount > 0
                  ? "Beküldött alvállalkozói ajánlatok"
                  : undefined
              }
            />
          </td>
          <td
            className={cn(
              "px-0.5",
              excelMode && "ea-worksheet-actions opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
            )}
          >
            {!isReadOnly ? (
              <div className="flex items-center justify-end gap-0">
                {line.costItemId && line.pricingStatus === "unpriced" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-500"
                    title="Becsült ár az ártükörből"
                    onClick={() => onFillFromCatalog(line.id, line.costItemId!)}
                  >
                    <BookOpen className="h-3 w-3" />
                  </Button>
                ) : null}
                {line.costSource === "subcontractor" || line.pricingStatus === "rfq_pending" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-500 hover:text-amber-800"
                    title="Saját kivitelezés — kézi ár"
                    onClick={() => handleConvertToManual(line)}
                  >
                    <Hand className="h-3 w-3" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                  onClick={() => handleDeleteLine(line.id, internalId)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </td>
        </tr>
        {showBidExpand ? (
          <QuoteLineBidExpandRow
            line={line}
            quoteId={quoteId}
            allLines={lines}
            expanded={bidExpanded}
            onToggle={() => onExpandedBidLineIdChange(bidExpanded ? null : line.id)}
            colSpan={TABLE_COLS}
          />
        ) : null}
      </Fragment>
    )
  }

  let lineCounter = 0

  return (
    <div
      className={cn(
        "ea-worksheet flex min-h-0 flex-1 flex-col overflow-hidden border border-[#b4b4b4] bg-white",
        sheetDensity === "normal" && "ea-worksheet-density-normal",
        excelMode && "ea-worksheet-max"
      )}
    >
      <div
        ref={gridRef}
        className="min-h-0 flex-1 overflow-auto"
        onPaste={handlePaste}
        tabIndex={-1}
        onClick={(e) => {
          const td = (e.target as HTMLElement).closest("td[data-sheet-row]")
          if (!td) return
          const row = Number(td.getAttribute("data-sheet-row"))
          const col = td.getAttribute("data-sheet-col") as CostSheetCol | null
          if (Number.isFinite(row) && col && COST_SHEET_COLS.includes(col)) {
            setActiveCell({ row, col })
            focusSheetCell(gridRef.current, row, col)
          }
        }}
      >
        <table
          className="ea-worksheet-table text-sm"
          style={{ minWidth: COST_SHEET_MIN_WIDTH }}
        >
          <CostSheetColgroup />
          <thead className="ea-worksheet-head">
            <tr>
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.ssz}
                className="ea-freeze-col ea-freeze-0"
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.identifier}
                className="ea-freeze-col ea-freeze-1"
                nowrap
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.text}
                className="ea-freeze-col ea-freeze-2"
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.quantity}
                editable
                align="right"
                colActive={activeCell?.col === "quantity"}
              />
              <SheetHeaderCell label={COST_SHEET_HEADERS.unit} editable />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.materialUnit.short}
                sub={COST_SHEET_HEADERS.materialUnit.sub}
                title={COST_SHEET_HEADERS.materialUnit.full}
                editable
                align="right"
                colActive={activeCell?.col === "material"}
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.laborUnit.short}
                sub={COST_SHEET_HEADERS.laborUnit.sub}
                title={COST_SHEET_HEADERS.laborUnit.full}
                editable
                align="right"
                className="ea-sheet-zone-end"
                colActive={activeCell?.col === "labor"}
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.materialTotal.short}
                sub={COST_SHEET_HEADERS.materialTotal.sub}
                title={COST_SHEET_HEADERS.materialTotal.full}
                align="right"
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.laborTotal.short}
                sub={COST_SHEET_HEADERS.laborTotal.sub}
                title={COST_SHEET_HEADERS.laborTotal.full}
                align="right"
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.lineTotal.short}
                sub={COST_SHEET_HEADERS.lineTotal.sub}
                title={COST_SHEET_HEADERS.lineTotal.full}
                align="right"
              />
              <SheetHeaderCell
                label={COST_SHEET_HEADERS.source.short}
                title={COST_SHEET_HEADERS.source.full}
                align="center"
              />
              <SheetHeaderCell label="" className="ea-sheet-head-readonly" />
            </tr>
          </thead>
          <tbody>
            {sheetRows.map((row, idx) => {
              if (row.kind === "section") {
                const sub = sectionSubtotals.get(row.trade)
                return (
                  <tr key={`section-${row.trade}`} className="ea-worksheet-section">
                    <td colSpan={7} className="ea-freeze-col ea-freeze-0 font-semibold">
                      {getTradeLabel(row.trade)}
                      <span className="ml-2 font-normal text-amber-900/80">
                        ({row.lineCount} tétel)
                      </span>
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={sub ? formatHuf(sub.material) : "—"}
                        variant="computed"
                      />
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={sub ? formatHuf(sub.labor) : "—"}
                        variant="computed"
                      />
                    </td>
                    <td>
                      <SpreadsheetReadonlyCell
                        value={sub ? formatHuf(sub.total) : "—"}
                        variant="computed"
                        className="font-medium"
                      />
                    </td>
                    <td colSpan={2} />
                  </tr>
                )
              }
              lineCounter += 1
              return renderDataRow(row.line, row.sheetRow, lineCounter - 1)
            })}
          </tbody>
          {displayLines.length > 0 ? (
            <tfoot
              className={cn(
                "ea-worksheet-foot",
                costSourceFilterActive && "ea-worksheet-foot-filtered"
              )}
            >
              <tr>
                <SheetFooterLabelCell
                  label={footerLabel}
                  sub={COST_SHEET_FOOTER.sub}
                  colSpan={7}
                  className="ea-freeze-col ea-freeze-0"
                />
                <td>
                  <SpreadsheetReadonlyCell
                    value={formatHuf(displayCostTotals.material)}
                    variant="computed"
                    className="font-medium"
                    title="Nettó anyag összesen"
                  />
                </td>
                <td>
                  <SpreadsheetReadonlyCell
                    value={formatHuf(displayCostTotals.labor)}
                    variant="computed"
                    className="font-medium"
                    title="Nettó díj összesen"
                  />
                </td>
                <td>
                  <SpreadsheetReadonlyCell
                    value={formatHuf(displayCostTotals.total)}
                    variant="computed"
                    className="font-bold"
                    title="Nettó bekerülés összesen"
                  />
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>

        {displayLines.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {costSourceFilterActive ? (
              <>
                <p>Nincs tétel ezen a szűrőn.</p>
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onClearFilter}>
                  Szűrő törlése
                </Button>
              </>
            ) : (
              <p>Adj hozzá tételeket az ártükörből.</p>
            )}
          </div>
        ) : null}
      </div>

      {displayLines.length > 0 ? (
        <div className="ea-worksheet-legend shrink-0 px-2 py-1.5">
          <div className="mb-1 text-[10px] text-slate-600">
            <span className="font-medium">Bevitel</span>
            <span className="mx-1 text-slate-400">|</span>
            <span className="font-medium">Számított</span>
            <span className="mx-2 text-slate-400">·</span>
            Fehér = szerkeszthető · Szürke = számított · Tab / Ctrl+V
          </div>
          <div className="scale-90 origin-left [&_div]:text-[11px]">
            <CostSourceLegend />
          </div>
        </div>
      ) : null}
    </div>
  )
}
