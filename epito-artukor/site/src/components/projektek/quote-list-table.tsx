"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ChevronDown,
  Copy,
  FileDown,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import type { Quote, QuoteStatus } from "@/types/projects"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import type { QuoteSummary } from "@/lib/quote-summary"
import { formatHuf } from "@/lib/pricing"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import {
  quoteDisplayMarginPercent,
  quoteReadinessPercent,
  quoteTradeLabel,
} from "@/lib/quote-list-helpers"
import { buildQuoteContractContextMap } from "@/lib/quote-contract-context"
import {
  calcQuoteVatTotals,
  quoteVatChipLabel,
  resolveQuoteVatMode,
} from "@/lib/quote-client-summary"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const COL_COUNT = 7

function MoneyColumnHeader({
  title,
  sub,
  align = "right",
}: {
  title: string
  sub: string
  align?: "left" | "right"
}) {
  return (
    <th className={cn("px-3 py-3", align === "right" && "text-right")}>
      <span className="block text-xs font-bold text-slate-700">{title}</span>
      <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-slate-600">
        {sub}
      </span>
    </th>
  )
}

export type QuoteListRow = {
  quote: Quote
  summary: QuoteSummary
}

type QuoteListTableProps = {
  rows: QuoteListRow[]
  projectId: string
  onDuplicate: (quoteId: string) => void
  onDelete: (quoteId: string) => void
  onArchive: (quoteId: string) => void
  onStartRfq: (quoteId: string) => void
  onExportPdf?: (quoteId: string) => void
}

function formatMoney(value: number, hasLines: boolean, partial?: boolean): string {
  if (!hasLines) return "—"
  const formatted = formatHuf(value)
  return partial ? `~${formatted}` : formatted
}

function sortQuoteRows(rows: QuoteListRow[]): QuoteListRow[] {
  return [...rows].sort((a, b) => {
    const aArch = a.quote.status === "archived" ? 1 : 0
    const bArch = b.quote.status === "archived" ? 1 : 0
    if (aArch !== bArch) return aArch - bArch
    return quoteTradeLabel(a.quote).localeCompare(quoteTradeLabel(b.quote), "hu")
  })
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "mt-1 whitespace-nowrap px-2.5 py-0.5 text-xs font-semibold",
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

function ReadinessBar({
  percent,
  pricedCount,
  lineCount,
}: {
  percent: number
  pricedCount: number
  lineCount: number
}) {
  const tone =
    percent >= 100 ? "bg-emerald-600" : percent > 0 ? "bg-amber-500" : "bg-slate-200"
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums text-slate-800">{percent}% kész</span>
      <span className="text-xs font-medium text-slate-600">
        {lineCount > 0 ? `${pricedCount} / ${lineCount} tétel árazva` : "Nincs tétel"}
      </span>
    </div>
  )
}

export function QuoteBulkToolbar({
  count,
  singleActiveId,
  deletableCount,
  exportableCount,
  onClear,
  onArchive,
  onDelete,
  onDuplicate,
  onExportPdf,
  onStartRfq,
}: {
  count: number
  singleActiveId: string | null
  deletableCount: number
  exportableCount: number
  onClear: () => void
  onArchive: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExportPdf: () => void
  onStartRfq: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2.5">
      <span className="text-sm font-semibold text-blue-950">
        {count} szakág kijelölve
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {singleActiveId ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-sm"
            onClick={onStartRfq}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Bekérés indítása
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-blue-200 bg-white text-sm"
          onClick={onDuplicate}
        >
          <Copy className="mr-1.5 h-4 w-4" />
          Másolat
        </Button>
        {exportableCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-blue-200 bg-white text-sm"
            onClick={onExportPdf}
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            PDF ({exportableCount})
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-blue-200 bg-white text-sm"
          onClick={onArchive}
        >
          <Archive className="mr-1.5 h-4 w-4" />
          Archiválás
        </Button>
        {deletableCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-red-200 bg-white text-sm text-red-700 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Törlés ({deletableCount})
          </Button>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto h-8 text-sm text-blue-800"
        onClick={onClear}
      >
        <X className="mr-1.5 h-4 w-4" />
        Kijelölés törlése
      </Button>
    </div>
  )
}

function QuoteListTableRow({
  row,
  selected,
  onToggleSelect,
  onOpen,
  contractLabel,
  contractDrift,
}: {
  row: QuoteListRow
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  contractLabel?: string
  contractDrift?: boolean
}) {
  const { quote, summary } = row
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const isArchived = quote.status === "archived"
  const hasLines = summary.lineCount > 0
  const partial = summary.isPartialTotal
  const marginPct = quoteDisplayMarginPercent(summary)
  const readiness = quoteReadinessPercent(summary)
  const trade = quoteTradeLabel(quote)

  const marginTone =
    !summary.totalsCalculable || partial
      ? "warning"
      : marginPct != null && marginPct < getMinAcceptableMarginPercent()
        ? "warning"
        : "success"

  const sellVat = calcQuoteVatTotals(
    hasLines ? summary.sellTotal : 0,
    resolveQuoteVatMode(quote)
  )

  if (isArchived && !archivedExpanded) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
        <td colSpan={COL_COUNT} className="p-0">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-100"
            onClick={() => setArchivedExpanded(true)}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{trade}</span>
            <Badge variant="secondary" className="shrink-0 text-xs font-semibold">
              Archivált
            </Badge>
            <span className="shrink-0 text-sm tabular-nums font-bold text-slate-800">
              {formatMoney(summary.sellTotal, hasLines)}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr
      onClick={onOpen}
      className={cn(
        "border-b border-slate-100 text-sm cursor-pointer transition-colors",
        isArchived && "bg-slate-50/50 text-slate-600",
        selected && "bg-blue-50/60 hover:bg-blue-50",
        !selected && "hover:bg-slate-50/80"
      )}
    >
      <td className="w-10 px-2 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
        {!isArchived ? (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-400"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Kijelölés: ${trade}`}
          />
        ) : null}
      </td>

      <td className="px-3 py-3 align-middle">
        <div className="min-w-[9rem]">
          <span className="text-sm font-semibold text-slate-950">{trade}</span>
          {quote.title !== trade ? (
            <p className="mt-0.5 truncate text-sm text-slate-600" title={quote.title}>
              {quote.title}
            </p>
          ) : null}
          <QuoteStatusBadge status={quote.status} />
          {contractLabel ? (
            <Badge
              variant="outline"
              className={cn(
                "mt-1 text-[10px] font-semibold",
                contractDrift
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-emerald-300 bg-emerald-50 text-emerald-950"
              )}
              title={contractDrift ? "Az élő ár eltér a szerződött pillanatképtől" : undefined}
            >
              Szerződött{contractDrift ? " · eltérés" : ""}
            </Badge>
          ) : null}
          {isArchived ? (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                setArchivedExpanded(false)
              }}
            >
              Összecsuk
            </button>
          ) : null}
        </div>
      </td>

      <td className="px-3 py-3 align-middle">
        <ReadinessBar
          percent={readiness}
          pricedCount={summary.pricedCount}
          lineCount={summary.lineCount}
        />
      </td>

      <td className="px-3 py-3 align-middle text-right">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums text-slate-900",
            partial && "text-amber-950"
          )}
          title={partial ? "Részleges összeg — vannak még árazatlan tételek" : undefined}
        >
          {formatMoney(summary.costTotal, hasLines, partial)}
        </span>
      </td>

      <td className="px-3 py-3 align-middle text-right">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            marginTone === "success" ? "text-emerald-900" : "text-amber-900"
          )}
        >
          {summary.totalsCalculable || hasLines ? formatHuf(summary.marginTotal) : "—"}
          {marginPct != null && hasLines ? (
            <span className="ml-1 text-xs font-medium text-slate-600">({marginPct}%)</span>
          ) : null}
        </span>
      </td>

      <td className="px-3 py-3 align-middle text-right">
        <span
          className={cn(
            "text-sm font-bold tabular-nums text-blue-900",
            partial && "text-blue-800"
          )}
          title={partial ? "Részleges összeg — vannak még árazatlan tételek" : "Eladási ár ÁFA nélkül"}
        >
          {formatMoney(summary.sellTotal, hasLines, partial)}
        </span>
      </td>

      <td className="px-3 py-3 align-middle text-right">
        <span
          className={cn(
            "text-sm font-bold tabular-nums text-slate-950",
            partial && "text-amber-950"
          )}
          title={
            partial
              ? "Részleges összeg — vannak még árazatlan tételek"
              : sellVat.vatNote ?? undefined
          }
        >
          {formatMoney(sellVat.grossTotal, hasLines, partial)}
        </span>
        {hasLines ? (
          <p className="mt-0.5 text-xs font-semibold text-slate-600">
            {quoteVatChipLabel(quote)}
          </p>
        ) : null}
      </td>
    </tr>
  )
}

export function QuoteListTable({
  rows,
  projectId,
  onDuplicate,
  onDelete,
  onArchive,
  onStartRfq,
  onExportPdf,
}: QuoteListTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const sorted = useMemo(() => sortQuoteRows(rows), [rows])

  const activeRows = useMemo(
    () => sorted.filter((r) => r.quote.status !== "archived"),
    [sorted]
  )

  const rowById = useMemo(() => new Map(sorted.map((r) => [r.quote.id, r])), [sorted])

  const contractMap = useMemo(
    () => buildQuoteContractContextMap(projectId),
    [projectId, rows]
  )

  const selectedRows = useMemo(
    () =>
      [...selected]
        .map((id) => rowById.get(id))
        .filter((r): r is QuoteListRow => r != null),
    [selected, rowById]
  )

  const allActiveSelected =
    activeRows.length > 0 && activeRows.every((r) => selected.has(r.quote.id))

  const toggleAllActive = () => {
    if (allActiveSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(activeRows.map((r) => r.quote.id)))
    }
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedActive = selectedRows.filter((r) => r.quote.status !== "archived")
  const singleActiveId =
    selectedActive.length === 1 ? selectedActive[0].quote.id : null
  const deletableCount = selectedActive.filter((r) => r.summary.rfqCount === 0).length
  const exportableCount = selectedActive.filter(
    (r) => r.summary.readiness.canExportPdf
  ).length

  const bulkArchive = () => {
    const targets = selectedActive
    if (targets.length === 0) return
    if (!confirm(`${targets.length} szakág archiválása?`)) return
    for (const r of targets) onArchive(r.quote.id)
    setSelected(new Set())
  }

  const bulkDelete = () => {
    const targets = selectedActive.filter((r) => r.summary.rfqCount === 0)
    if (targets.length === 0) return
    if (!confirm(`${targets.length} szakág törlése?`)) return
    for (const r of targets) onDelete(r.quote.id)
    setSelected(new Set())
  }

  const bulkDuplicate = () => {
    for (const r of selectedActive) onDuplicate(r.quote.id)
    setSelected(new Set())
  }

  const bulkExportPdf = () => {
    for (const r of selectedActive) {
      if (r.summary.readiness.canExportPdf && onExportPdf) {
        onExportPdf(r.quote.id)
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[52rem] border-collapse">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400"
                  checked={allActiveSelected}
                  onChange={toggleAllActive}
                  aria-label="Összes aktív szakág kijelölése"
                  disabled={activeRows.length === 0}
                />
              </th>
              <th className="px-3 py-3">Szakág</th>
              <th className="px-3 py-3">Készültség</th>
              <MoneyColumnHeader title="Bekerülés" sub="nettó · ÁFA nélkül" />
              <MoneyColumnHeader title="Fedezet" sub="nettó" />
              <MoneyColumnHeader title="Eladás" sub="nettó" />
              <MoneyColumnHeader title="Bruttó" sub="ügyfélnek · ÁFA-val" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const contract = contractMap.get(row.quote.id)
              return (
              <QuoteListTableRow
                key={row.quote.id}
                row={row}
                selected={selected.has(row.quote.id)}
                onToggleSelect={() => toggleRow(row.quote.id)}
                onOpen={() =>
                  router.push(`/projektek/${projectId}/ajanlat/${row.quote.id}`)
                }
                contractLabel={contract?.isContracted ? contract.packageTitle : undefined}
                contractDrift={contract?.hasDrift}
              />
            )})}
          </tbody>
        </table>
      </div>
    </div>
  )
}
