"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import type { TradeDashboardRow } from "@/lib/project-overview-dashboard"
import type { QuoteStatus } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { QuoteBulkToolbar } from "@/components/projektek/quote-list-table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ProjectOverviewTradeTableProps = {
  rows: TradeDashboardRow[]
  projectId: string
  executionMode?: boolean
  onDuplicate: (quoteId: string) => void
  onDelete: (quoteId: string) => void
  onArchive: (quoteId: string) => void
  onStartRfq: (quoteId: string) => void
  onExportPdf?: (quoteId: string) => void
}

function MoneyColumnHeader({
  title,
  sub,
}: {
  title: string
  sub: string
}) {
  return (
    <th className="px-3 py-3 text-right">
      <span className="block text-xs font-bold text-slate-700">{title}</span>
      <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-slate-600">
        {sub}
      </span>
    </th>
  )
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap px-2.5 py-0.5 text-xs font-semibold",
        status === "accepted" && "border-emerald-400 bg-emerald-100 text-emerald-950",
        status === "sent" && "border-blue-400 bg-blue-100 text-blue-950",
        status === "draft" && "border-slate-300 bg-slate-100 text-slate-800",
        status === "rejected" && "border-red-300 bg-red-100 text-red-900",
        status === "archived" && "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  )
}

function formatMoney(value: number, hasLines: boolean, partial?: boolean): string {
  if (!hasLines) return "—"
  const formatted = formatHuf(value)
  return partial ? `~${formatted}` : formatted
}

function TradeTableRow({
  row,
  selected,
  executionMode,
  onToggleSelect,
  onOpen,
}: {
  row: TradeDashboardRow
  selected: boolean
  executionMode?: boolean
  onToggleSelect: () => void
  onOpen: () => void
}) {
  const hasLines = row.lineCount > 0
  const partial = row.isPartialTotal
  const marginLow =
    row.marginPercent != null && row.marginPercent < getMinAcceptableMarginPercent()
  const marginTone =
    !hasLines || partial
      ? "warning"
      : marginLow
        ? "warning"
        : "success"

  return (
    <tr
      onClick={onOpen}
      className={cn(
        "cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50/80",
        selected && "bg-blue-50/50 hover:bg-blue-50/70"
      )}
    >
      <td className="w-10 px-2 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-400"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Kijelölés: ${row.tradeLabel}`}
        />
      </td>

      <td className="px-3 py-3 align-middle">
        <div className="min-w-[8rem] max-w-[14rem]">
          <p className="text-sm font-semibold leading-snug text-slate-950">{row.tradeLabel}</p>
          <p className="mt-0.5 text-sm leading-snug text-slate-600">{row.quoteTitle}</p>
        </div>
      </td>

      <td className="px-3 py-3 align-middle">
        <QuoteStatusBadge status={row.status} />
      </td>

      <td className="px-3 py-3 align-middle text-right tabular-nums">
        {executionMode && row.status === "accepted" && row.executionTotal != null ? (
          <div>
            <span
              className={cn(
                "text-sm font-bold",
                row.executionDone === row.executionTotal
                  ? "text-emerald-800"
                  : "text-slate-800"
              )}
            >
              {row.executionDone} / {row.executionTotal}
            </span>
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              {row.executionPercent}% kész
            </p>
          </div>
        ) : hasLines ? (
          <div>
            <span
              className={cn(
                "text-sm font-bold",
                row.unpricedCount > 0 ? "text-amber-900" : "text-slate-700"
              )}
            >
              {row.unpricedCount}
            </span>
            {row.unpricedCount > 0 ? (
              <p className="mt-0.5 text-xs font-medium text-amber-800">árazatlan</p>
            ) : (
              <p className="mt-0.5 text-xs font-medium text-emerald-700">kész</p>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </td>

      <td className="px-3 py-3 align-middle text-right tabular-nums">
        <span className="text-sm font-semibold text-slate-900">
          {formatMoney(row.costNet, hasLines, partial)}
        </span>
      </td>

      <td className="px-3 py-3 align-middle text-right tabular-nums">
        <span
          className={cn(
            "text-sm font-semibold",
            marginTone === "success" ? "text-emerald-900" : "text-amber-900"
          )}
        >
          {formatMoney(row.marginNet, hasLines, partial)}
          {row.marginPercent != null && hasLines ? (
            <span className="ml-1 text-xs font-medium text-slate-600">({row.marginPercent}%)</span>
          ) : null}
        </span>
      </td>

      <td className="px-3 py-3 align-middle text-right tabular-nums">
        <span
          className={cn(
            "text-sm font-bold text-slate-950",
            partial && "text-amber-950"
          )}
          title={partial ? "Részleges összeg — vannak még árazatlan tételek" : undefined}
        >
          {formatMoney(row.grossTotal, hasLines, partial)}
        </span>
      </td>
    </tr>
  )
}

export function ProjectOverviewTradeTable({
  rows,
  projectId,
  executionMode = false,
  onDuplicate,
  onDelete,
  onArchive,
  onStartRfq,
  onExportPdf,
}: ProjectOverviewTradeTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.tradeLabel.localeCompare(b.tradeLabel, "hu")),
    [rows]
  )

  const rowById = useMemo(() => new Map(sorted.map((r) => [r.quoteId, r])), [sorted])

  const selectedRows = useMemo(
    () =>
      [...selected]
        .map((id) => rowById.get(id))
        .filter((r): r is TradeDashboardRow => r != null),
    [selected, rowById]
  )

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.quoteId))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(sorted.map((r) => r.quoteId)))
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const singleActiveId = selectedRows.length === 1 ? selectedRows[0].quoteId : null
  const deletableCount = selectedRows.filter((r) => r.rfqCount === 0).length
  const exportableCount = selectedRows.filter((r) => r.canExportPdf).length

  const bulkArchive = () => {
    if (selectedRows.length === 0) return
    if (!confirm(`${selectedRows.length} szakág archiválása?`)) return
    for (const r of selectedRows) onArchive(r.quoteId)
    setSelected(new Set())
  }

  const bulkDelete = () => {
    const targets = selectedRows.filter((r) => r.rfqCount === 0)
    if (targets.length === 0) return
    if (!confirm(`${targets.length} szakág törlése?`)) return
    for (const r of targets) onDelete(r.quoteId)
    setSelected(new Set())
  }

  const bulkDuplicate = () => {
    for (const r of selectedRows) onDuplicate(r.quoteId)
    setSelected(new Set())
  }

  const bulkExportPdf = () => {
    for (const r of selectedRows) {
      if (r.canExportPdf && onExportPdf) onExportPdf(r.quoteId)
    }
  }

  if (rows.length === 0) {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-900">Szakágok</h3>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-800">Még nincs szakág</p>
          <p className="mt-1 text-sm text-slate-600">
            Add hozzá az első költségvetést a Költségvetés fülön.
          </p>
        </div>
      </section>
    )
  }

  return (
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h3 className="text-base font-semibold text-slate-900">Szakágok</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
          {rows.length} db
        </span>
      </div>

      {selected.size > 0 ? (
        <QuoteBulkToolbar
          count={selected.size}
          singleActiveId={singleActiveId}
          deletableCount={deletableCount}
          exportableCount={exportableCount}
          onClear={() => setSelected(new Set())}
          onArchive={bulkArchive}
          onDelete={bulkDelete}
          onDuplicate={bulkDuplicate}
          onExportPdf={bulkExportPdf}
          onStartRfq={() => {
            if (singleActiveId) onStartRfq(singleActiveId)
          }}
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Összes szakág kijelölése"
                />
              </th>
              <th className="px-3 py-3">Szakág</th>
              <th className="px-3 py-3">Státusz</th>
              <th className="px-3 py-3 text-right">
                {executionMode ? "Készültség" : "Árazatlan"}
              </th>
              <MoneyColumnHeader title="Bekerülés" sub="nettó" />
              <MoneyColumnHeader title="Fedezet" sub="nettó" />
              <MoneyColumnHeader title="Bruttó" sub="ügyfélnek" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <TradeTableRow
                key={row.quoteId}
                row={row}
                selected={selected.has(row.quoteId)}
                executionMode={executionMode}
                onToggleSelect={() => toggleRow(row.quoteId)}
                onOpen={() =>
                  router.push(`/projektek/${projectId}/ajanlat/${row.quoteId}`)
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
