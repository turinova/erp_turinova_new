"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Circle, FileCheck2 } from "lucide-react"
import { toast } from "sonner"
import type { Quote, QuoteLine } from "@/types/projects"
import type { Trade } from "@/types"
import { QUOTE_EXCEL_COLUMNS } from "@/lib/quote-columns"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
  getLineSectionNumber,
} from "@/lib/quote-line-display"
import {
  setAllQuoteLinesExecution,
  toggleQuoteLineExecution,
} from "@/lib/data/projects-store"
import {
  buildContractedSellMap,
  computeExecutionFinancialTotals,
  computeExecutionLineFinancials,
  computeQuoteExecutionStats,
  filterLinesByExecution,
  isLineEligibleForTig,
  isLineExecutionDone,
  isLineTigCertified,
  type ExecutionFilter,
} from "@/lib/quote-execution"
import { getPerformanceCertificate } from "@/lib/data/projects-store"
import { formatHuf } from "@/lib/pricing"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import {
  getQuoteLineRowClass,
  getQuoteLineVisualKind,
  QuoteLineSourceIcon,
} from "@/lib/quote-line-visual"
import { unitMap } from "@/lib/data/units-store"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { QuoteTableFooterSummary } from "@/components/projektek/quote-table-footer-summary"
import { TigCreateDialog } from "@/components/projektek/tig-create-dialog"
import { cn } from "@/lib/utils"

const COL = QUOTE_EXCEL_COLUMNS

type QuoteExecutionPanelProps = {
  projectId: string
  quoteId: string
  quote: Quote
  quoteTrade: Trade
  lines: QuoteLine[]
  onRefresh: () => void
}

const FILTER_OPTIONS: { id: ExecutionFilter; label: string }[] = [
  { id: "pending", label: "Még nem kész" },
  { id: "done", label: "Kész" },
  { id: "all", label: "Mind" },
]

function DoneCheckbox({
  done,
  onToggle,
  size = "md",
  disabled = false,
}: {
  done: boolean
  onToggle: () => void
  size?: "md" | "lg"
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center justify-center",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        size === "lg" ? "min-h-11 min-w-11 p-2" : "min-h-9 min-w-9 p-1"
      )}
    >
      <Checkbox
        checked={done}
        disabled={disabled}
        onCheckedChange={(checked) => {
          if (disabled) return
          if (checked === "indeterminate") return
          if (checked !== done) onToggle()
        }}
        className={cn(
          "rounded-md border-2 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600",
          size === "lg" ? "h-7 w-7" : "h-6 w-6"
        )}
        aria-label={done ? "Kész — kattints a visszavonáshoz" : "Nem kész — jelöld késznek"}
      />
    </label>
  )
}

export function QuoteExecutionPanel({
  projectId,
  quoteId,
  quote,
  quoteTrade,
  lines,
  onRefresh,
}: QuoteExecutionPanelProps) {
  const [filter, setFilter] = useState<ExecutionFilter>("all")
  const [tigDialogOpen, setTigDialogOpen] = useState(false)

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => a.sortOrder - b.sortOrder),
    [lines]
  )

  const stats = useMemo(() => computeQuoteExecutionStats(sortedLines), [sortedLines])
  const eligibleTigCount = useMemo(
    () => sortedLines.filter(isLineEligibleForTig).length,
    [sortedLines]
  )
  const displayLines = useMemo(
    () => filterLinesByExecution(sortedLines, filter),
    [sortedLines, filter]
  )

  const costItemById = useMemo(() => buildCostItemMap(loadCostItems()), [lines])
  const sectionNumbers = useMemo(() => buildLineSectionNumbers(lines), [lines])
  const contractedSell = useMemo(
    () => buildContractedSellMap(projectId, quoteId),
    [projectId, quoteId, lines]
  )

  const financialTotals = useMemo(
    () => computeExecutionFinancialTotals(sortedLines, quote, contractedSell),
    [sortedLines, quote, contractedSell]
  )

  const marginLow =
    financialTotals.marginPercent != null &&
    financialTotals.marginPercent < getMinAcceptableMarginPercent()

  const handleToggle = (lineId: string) => {
    const line = sortedLines.find((l) => l.id === lineId)
    if (line && isLineTigCertified(line)) {
      toast.message("Ez a tétel már szerepel egy rögzített TIG-ben")
      return
    }
    const result = toggleQuoteLineExecution(lineId)
    onRefresh()
    if (result) {
      const nowDone = result.executionStatus === "done"
      toast.success(nowDone ? "Késznek jelölve" : "Visszaállítva: nem kész", {
        duration: 1500,
      })
    }
  }

  const handleMarkAll = (done: boolean) => {
    const n = setAllQuoteLinesExecution(quoteId, done ? "done" : "pending", quoteTrade)
    onRefresh()
    if (n > 0) {
      toast.success(done ? `${n} tétel késznek jelölve` : `${n} tétel visszaállítva`)
    }
  }

  if (sortedLines.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-800">Nincs tétel ebben a szakágban</p>
          <p className="mt-1 text-sm text-slate-600">
            A Bekerülés nézetben adhatsz hozzá tételeket.
          </p>
        </div>
      </div>
    )
  }

  const renderTigBadge = (line: QuoteLine) => {
    if (!line.tigDocumentId) return null
    const cert = getPerformanceCertificate(line.tigDocumentId)
    return (
      <span
        className="ml-1.5 inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800"
        title={cert ? `TIG: ${cert.documentNumber}` : "TIG-ben szerepel"}
      >
        TIG
      </span>
    )
  }

  const renderMobileCard = (line: QuoteLine, rowIndex: number) => {
    const done = isLineExecutionDone(line)
    const tigLocked = isLineTigCertified(line)
    const fin = computeExecutionLineFinancials(line, quote, contractedSell)
    const unitLabel = unitMap[line.unitId]?.code ?? "db"
    const visualKind = getQuoteLineVisualKind(line)
    const rowMarginLow =
      fin.marginPercent != null && fin.marginPercent < getMinAcceptableMarginPercent()

    return (
      <article
        key={line.id}
        className={cn(
          "rounded-xl border bg-white p-3 shadow-sm",
          done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"
        )}
      >
        <div className="flex items-start gap-2">
          <DoneCheckbox
            done={done}
            onToggle={() => handleToggle(line.id)}
            size="lg"
            disabled={tigLocked}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-code text-xs text-slate-500">
                {getLineSectionNumber(line.id, sectionNumbers, rowIndex + 1)}
              </span>
              <span className="font-code text-xs font-semibold text-blue-700">
                {getLineInternalIdentifier(line, costItemById)}
              </span>
              <QuoteLineSourceIcon line={line} compact />
              {renderTigBadge(line)}
            </div>
            <p
              className={cn(
                "mt-1 text-sm leading-snug text-slate-900",
                done && "text-slate-600 line-through decoration-slate-400/70"
              )}
            >
              {line.textSnapshot}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {line.quantity} {unitLabel}
            </p>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2">
            <dt className="font-semibold text-zinc-700">Bekerülés</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-zinc-900">
              {fin.isCosted ? formatHuf(fin.cost) : "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
            <dt className="font-semibold text-blue-900">Szerződött ár</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-blue-950">
              {fin.contractedSell > 0 ? formatHuf(fin.contractedSell) : "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2">
            <dt className="font-semibold text-violet-900">Fedezet %</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-violet-950">
              {fin.markupPercent != null ? `${fin.markupPercent}%` : "—"}
            </dd>
          </div>
          <div
            className={cn(
              "rounded-lg border px-2.5 py-2",
              rowMarginLow
                ? "border-amber-300 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            )}
          >
            <dt
              className={cn(
                "font-semibold",
                rowMarginLow ? "text-amber-900" : "text-emerald-900"
              )}
            >
              Fedezet összeg
            </dt>
            <dd
              className={cn(
                "mt-0.5 font-bold tabular-nums",
                rowMarginLow ? "text-amber-950" : "text-emerald-950"
              )}
            >
              {fin.isCosted && fin.contractedSell > 0 ? (
                <>
                  +{formatHuf(fin.margin)}
                  {fin.marginPercent != null ? (
                    <span className="ml-1 text-[11px] font-semibold">({fin.marginPercent}%)</span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </article>
    )
  }

  const renderDesktopRow = (line: QuoteLine, rowIndex: number) => {
    const done = isLineExecutionDone(line)
    const tigLocked = isLineTigCertified(line)
    const fin = computeExecutionLineFinancials(line, quote, contractedSell)
    const visualKind = getQuoteLineVisualKind(line)
    const unitLabel = unitMap[line.unitId]?.code ?? "db"
    const rowMarginLow =
      fin.marginPercent != null && fin.marginPercent < getMinAcceptableMarginPercent()

    return (
      <tr
        key={line.id}
        className={cn(
          "border-b [&_td]:align-top",
          getQuoteLineRowClass(visualKind),
          done && "bg-emerald-50/50"
        )}
      >
        <td className="px-1.5 py-1.5 text-center">
          <DoneCheckbox
            done={done}
            onToggle={() => handleToggle(line.id)}
            disabled={tigLocked}
          />
        </td>
        <td className="px-2 py-1.5 font-code text-xs text-slate-600">
          {getLineSectionNumber(line.id, sectionNumbers, rowIndex + 1)}
        </td>
        <td className="px-2 py-1.5 font-code text-xs font-medium text-blue-700">
          {getLineInternalIdentifier(line, costItemById)}
        </td>
        <td className="min-w-[10rem] max-w-md px-2 py-1.5 text-xs">
          <span
            className={cn(
              "block whitespace-normal break-words leading-snug",
              done ? "text-slate-600 line-through decoration-slate-400/70" : "text-slate-900"
            )}
          >
            {line.textSnapshot}
            {renderTigBadge(line)}
          </span>
        </td>
        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-800">
          {line.quantity}
        </td>
        <td className="px-2 py-1.5 text-xs text-slate-600">{unitLabel}</td>
        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-800">
          {fin.isCosted ? formatHuf(fin.cost) : "—"}
        </td>
        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-violet-800">
          {fin.markupPercent != null ? `${fin.markupPercent}%` : "—"}
        </td>
        <td className="px-2 py-1.5 text-right text-xs font-medium tabular-nums text-blue-900">
          {fin.contractedSell > 0 ? formatHuf(fin.contractedSell) : "—"}
        </td>
        <td className="px-2 py-1.5 text-right text-xs tabular-nums">
          {fin.isCosted && fin.contractedSell > 0 ? (
            <span
              className={cn(
                "font-medium",
                rowMarginLow ? "text-amber-800" : "text-emerald-800"
              )}
            >
              +{formatHuf(fin.margin)}
              {fin.marginPercent != null ? (
                <span className="ml-1 font-normal text-slate-500">({fin.marginPercent}%)</span>
              ) : null}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-2 py-1.5 text-center">
          <QuoteLineSourceIcon line={line} compact />
        </td>
      </tr>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {stats.done} / {stats.total} tétel kész
            </p>
            <p className="text-xs text-slate-600">Pipáld ki, amit már elvégeztetek</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {eligibleTigCount > 0 ? (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 bg-emerald-600 px-3 text-xs hover:bg-emerald-700 sm:h-8"
                onClick={() => setTigDialogOpen(true)}
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                TIG ({eligibleTigCount})
              </Button>
            ) : null}
            {stats.pending > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs sm:h-8"
                onClick={() => handleMarkAll(true)}
              >
                Mind kész
              </Button>
            ) : null}
            {stats.done > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 px-3 text-xs text-slate-600 sm:h-8"
                onClick={() => handleMarkAll(false)}
              >
                Visszaállítás
              </Button>
            ) : null}
          </div>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${stats.percent}%` }}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.id === "all"
                ? stats.total
                : opt.id === "done"
                  ? stats.done
                  : stats.pending
            return (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={filter === opt.id ? "default" : "outline"}
                className="h-9 shrink-0 px-3 text-xs sm:h-8"
                onClick={() => setFilter(opt.id)}
              >
                {opt.label} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {/* Mobil: kártyák */}
      <div className="min-h-0 flex-1 overflow-auto p-3 md:hidden">
        {displayLines.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {filter === "pending"
              ? "Minden tétel kész — szép munka!"
              : filter === "done"
                ? "Még nincs kész tétel"
                : "Nincs megjeleníthető tétel"}
          </p>
        ) : (
          <div className="space-y-3">
            {displayLines.map((line, i) => renderMobileCard(line, i))}
          </div>
        )}
      </div>

      {/* Asztal / tablet: táblázat — ugyanaz a struktúra mint fedezet/ajánlat */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="ea-table-head sticky top-0 z-10 text-xs shadow-sm">
                <tr>
                  <th className="w-10 px-1.5 py-1.5 text-center">Kész</th>
                  <th className="px-2 py-1.5">{COL.ssz}</th>
                  <th className="px-2 py-1.5">{COL.identifier}</th>
                  <th className="px-2 py-1.5">{COL.text}</th>
                  <th className="px-2 py-1.5 text-right">{COL.quantity}</th>
                  <th className="px-2 py-1.5">{COL.unit}</th>
                  <th className="px-2 py-1.5 text-right">Bekerülés</th>
                  <th className="px-2 py-1.5 text-right">Fedezet %</th>
                  <th className="px-2 py-1.5 text-right">Szerződött ár</th>
                  <th className="px-2 py-1.5 text-right">Fedezet összeg</th>
                  <th className="w-10 px-2 py-1.5" title="Forrás">
                    Forr.
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayLines.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                      {filter === "pending"
                        ? "Minden tétel kész — szép munka!"
                        : filter === "done"
                          ? "Még nincs kész tétel"
                          : "Nincs megjeleníthető tétel"}
                    </td>
                  </tr>
                ) : (
                  displayLines.map((line, i) => renderDesktopRow(line, i))
                )}
              </tbody>
            </table>
          </div>

          <QuoteTableFooterSummary
            label="Összesen"
            cells={[
              {
                label: "Bekerülés",
                value: formatHuf(financialTotals.cost),
                tone: "cost",
              },
              {
                label: "Szerződött ár",
                value: formatHuf(financialTotals.contractedSell),
                tone: "blue",
              },
              {
                label: "Élő fedezet",
                value: formatHuf(financialTotals.margin),
                suffix:
                  financialTotals.marginPercent != null
                    ? `${financialTotals.marginPercent}%`
                    : undefined,
                tone: marginLow ? "amber" : "emerald",
                emphasis: true,
              },
            ]}
          />
        </div>
      </div>

      {/* Mobil összesítő */}
      <div className="shrink-0 border-t border-slate-200 bg-white md:hidden">
        <QuoteTableFooterSummary
          label="Összesen"
          cells={[
            {
              label: "Bekerülés",
              value: formatHuf(financialTotals.cost),
              tone: "cost",
            },
            {
              label: "Szerződött",
              value: formatHuf(financialTotals.contractedSell),
              tone: "blue",
            },
            {
              label: "Fedezet",
              value: formatHuf(financialTotals.margin),
              suffix:
                financialTotals.marginPercent != null
                  ? `${financialTotals.marginPercent}%`
                  : undefined,
              tone: marginLow ? "amber" : "emerald",
              emphasis: true,
            },
          ]}
        />
        <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            {stats.percent === 100 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4 text-slate-400" />
            )}
            {stats.percent}% kész
          </span>
        </div>
      </div>

      <TigCreateDialog
        open={tigDialogOpen}
        onOpenChange={setTigDialogOpen}
        projectId={projectId}
        quote={quote}
        lines={sortedLines}
        onSaved={onRefresh}
      />
    </div>
  )
}
