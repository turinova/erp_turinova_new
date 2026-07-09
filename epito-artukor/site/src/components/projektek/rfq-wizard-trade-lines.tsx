"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import type { QuoteLine } from "@/types/projects"
import { QUOTE_EXCEL_COLUMNS as COL } from "@/lib/quote-columns"
import { isLineCosted } from "@/lib/quote-pricing"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
  getLineSectionNumber,
  lineMatchesInternalSearch,
} from "@/lib/quote-line-display"
import { unitMap } from "@/lib/data/units-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function defaultRfqLineIds(lines: QuoteLine[]): string[] {
  const needsRfq = lines.filter((l) => !isLineCosted(l) || l.pricingStatus === "rfq_pending")
  if (needsRfq.length > 0) return needsRfq.map((l) => l.id)
  return lines.map((l) => l.id)
}

export function buildInitialLineSelection(
  quotes: { id: string; lines: QuoteLine[] }[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const q of quotes) {
    out[q.id] = defaultRfqLineIds(q.lines)
  }
  return out
}

type LinePreset = "unpriced" | "all" | "none"

function applyLinePreset(lines: QuoteLine[], preset: LinePreset): string[] {
  if (preset === "none") return []
  if (preset === "all") return lines.map((l) => l.id)
  return defaultRfqLineIds(lines)
}

type RfqWizardTradeLinesProps = {
  quoteId: string
  lines: QuoteLine[]
  selectedLineIds: string[]
  onChange: (lineIds: string[]) => void
}

export function RfqWizardTradeLines({
  lines,
  selectedLineIds,
  onChange,
}: RfqWizardTradeLinesProps) {
  const [search, setSearch] = useState("")
  const selectedSet = useMemo(() => new Set(selectedLineIds), [selectedLineIds])
  const costItemById = useMemo(() => buildCostItemMap(loadCostItems()), [])
  const sectionNumbers = useMemo(() => buildLineSectionNumbers(lines), [lines])

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((line) => lineMatchesInternalSearch(line, q, costItemById))
  }, [lines, search, costItemById])

  const toggleLine = (lineId: string) => {
    if (selectedSet.has(lineId)) {
      onChange(selectedLineIds.filter((id) => id !== lineId))
    } else {
      onChange([...selectedLineIds, lineId])
    }
  }

  const applyPreset = (preset: LinePreset) => {
    onChange(applyLinePreset(lines, preset))
  }

  return (
    <div className="border-t bg-white px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés tételszám / szöveg…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => applyPreset("unpriced")}
        >
          Csak árazatlan
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => applyPreset("all")}
        >
          Teljes szakág
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={() => applyPreset("none")}
        >
          Egyik sem
        </Button>
      </div>

      <div className="max-h-56 overflow-auto rounded border">
        <table className="w-full min-w-[36rem] border-collapse text-xs">
          <thead className="ea-table-head sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="w-8 px-2 py-1.5" />
              <th className="px-2 py-1.5 text-left">{COL.ssz}</th>
              <th className="px-2 py-1.5 text-left">{COL.identifier}</th>
              <th className="px-2 py-1.5 text-left">{COL.text}</th>
              <th className="px-2 py-1.5 text-right">{COL.quantity}</th>
              <th className="px-2 py-1.5">{COL.unit}</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((line) => {
              const rowNum = getLineSectionNumber(line.id, sectionNumbers)
              const internalId = getLineInternalIdentifier(line, costItemById)
              const checked = selectedSet.has(line.id)
              const costed = isLineCosted(line)
              return (
                <tr
                  key={line.id}
                  className={cn(
                    "border-b border-slate-100 hover:bg-slate-50/80",
                    checked && "bg-blue-50/30"
                  )}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLine(line.id)}
                      aria-label={`${internalId} kijelölése`}
                    />
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{rowNum}</td>
                  <td className="px-2 py-1.5 font-code font-medium text-blue-700">
                    {internalId}
                  </td>
                  <td className="max-w-md px-2 py-1.5">
                    <span className="block whitespace-normal break-words leading-snug text-slate-900">
                      {line.textSnapshot}
                    </span>
                    {!costed ? (
                      <span className="text-[10px] text-amber-800">árazatlan</span>
                    ) : line.costSource === "manual" ? (
                      <span className="text-[10px] text-amber-800">kézi ár</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                    {line.quantity}
                  </td>
                  <td className="px-2 py-1.5 text-slate-700">
                    {unitMap[line.unitId]?.code ?? line.unitId}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredLines.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">Nincs találat.</p>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {selectedLineIds.length} / {lines.length} tétel kerül a bekérésbe
      </p>
    </div>
  )
}

type RfqWizardTradeScopeRowProps = {
  tradeLabel: string
  lineCount: number
  selectedLineCount: number
  checked: boolean
  disabled: boolean
  expanded: boolean
  onToggleTrade: () => void
  onToggleExpand: () => void
  children?: ReactNode
}

export function RfqWizardTradeScopeRow({
  tradeLabel,
  lineCount,
  selectedLineCount,
  checked,
  disabled,
  expanded,
  onToggleTrade,
  onToggleExpand,
  children,
}: RfqWizardTradeScopeRowProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        checked && "border-blue-300 bg-blue-50/30",
        disabled && "opacity-50"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <input
          type="checkbox"
          className="mt-0.5 shrink-0"
          checked={checked}
          disabled={disabled}
          onChange={onToggleTrade}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{tradeLabel}</p>
          <p className="text-sm text-slate-600">
            {lineCount > 0 ? (
              <>
                <span className="font-medium text-slate-800">{selectedLineCount}</span>
                {" / "}
                {lineCount} tétel a bekérésben
              </>
            ) : (
              "Nincs tétel — előbb a költségvetésben adj hozzá"
            )}
          </p>
        </div>
        {checked && lineCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-xs"
            onClick={onToggleExpand}
          >
            {expanded ? (
              <>
                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                Tételek elrejtése
              </>
            ) : (
              <>
                <ChevronRight className="mr-1 h-3.5 w-3.5" />
                Tételek szerkesztése
              </>
            )}
          </Button>
        ) : null}
      </div>
      {checked && expanded && children ? children : null}
    </div>
  )
}
