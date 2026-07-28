"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  CheckSquare,
  Copy,
  FileText,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react"
import type { Quote } from "@/types/projects"
import type { QuoteSummary } from "@/lib/quote-summary"
import { formatHuf } from "@/lib/pricing"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import { quoteTradeLabel } from "@/lib/quote-list-helpers"
import type { QuoteContractContext } from "@/lib/quote-contract-context"
import {
  calcQuoteVatTotals,
  resolveQuoteVatMode,
} from "@/lib/quote-client-summary"
import {
  pricingProgress,
  secondaryQuoteTitle,
  subcontractorProgress,
} from "@/lib/quote-trade-progress"
import {
  PricingProgressCell,
  SubcontractorProgressCell,
} from "@/components/projektek/quote-trade-progress-cells"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type QuoteListRow = {
  quote: Quote
  summary: QuoteSummary
}

type QuoteListTableProps = {
  rows: QuoteListRow[]
  projectId: string
  contractMap?: Map<string, QuoteContractContext>
  onDuplicate: (quoteId: string) => void
  onDelete: (quoteId: string) => void
  onArchive: (quoteId: string) => void
  onStartRfq: (quoteId: string) => void
  /** Kijelölt szakágakból ügyfélajánlat */
  onCreateOffer?: (quoteIds: string[]) => void
}

function formatMoney(value: number, hasLines: boolean, partial?: boolean): string {
  if (!hasLines) return "—"
  const formatted = formatHuf(value)
  return partial ? `~${formatted}` : formatted
}

function sortActive(rows: QuoteListRow[]): QuoteListRow[] {
  return [...rows]
    .filter((r) => r.quote.status !== "archived")
    .sort((a, b) =>
      quoteTradeLabel(a.quote).localeCompare(quoteTradeLabel(b.quote), "hu")
    )
}

function sortArchived(rows: QuoteListRow[]): QuoteListRow[] {
  return [...rows]
    .filter((r) => r.quote.status === "archived")
    .sort((a, b) =>
      quoteTradeLabel(a.quote).localeCompare(quoteTradeLabel(b.quote), "hu")
    )
}

function grossFor(quote: Quote, summary: QuoteSummary): number {
  if (summary.lineCount === 0) return 0
  return calcQuoteVatTotals(summary.sellTotal, resolveQuoteVatMode(quote)).grossTotal
}

export function QuoteBulkToolbar({
  count,
  singleActiveId,
  deletableCount,
  onClear,
  onArchive,
  onDelete,
  onDuplicate,
  onStartRfq,
  onCreateOffer,
}: {
  count: number
  singleActiveId: string | null
  deletableCount: number
  onClear: () => void
  onArchive: () => void
  onDelete: () => void
  onDuplicate: () => void
  onStartRfq: () => void
  onCreateOffer?: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3">
      <span className="text-base font-semibold text-blue-950">
        {count} szakág kijelölve
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {onCreateOffer ? (
          <Button
            type="button"
            className="h-11 text-sm font-semibold"
            onClick={onCreateOffer}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            Ügyfélajánlat
          </Button>
        ) : null}
        {singleActiveId ? (
          <Button
            type="button"
            variant="secondary"
            className="h-11 text-sm font-semibold"
            onClick={onStartRfq}
          >
            Bekérés indítása
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-11 border-blue-200 bg-white text-sm font-semibold"
          onClick={onDuplicate}
        >
          <Copy className="mr-1.5 h-4 w-4" />
          Másolat
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 border-blue-200 bg-white text-sm font-semibold"
          onClick={onArchive}
        >
          <Archive className="mr-1.5 h-4 w-4" />
          Archiválás
        </Button>
        {deletableCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 border-red-200 bg-white text-sm font-semibold text-red-700 hover:bg-red-50"
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
        className="ml-auto h-11 text-sm font-semibold text-blue-800"
        onClick={onClear}
      >
        <X className="mr-1.5 h-4 w-4" />
        Mégsem
      </Button>
    </div>
  )
}

function RowMenu({
  quoteId,
  canDelete,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  quoteId: string
  canDelete: boolean
  onDuplicate: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-11 p-0"
          aria-label="További műveletek"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem] p-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate(quoteId)
          }}
        >
          <Copy className="h-4 w-4" />
          Másolat
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
          onClick={(e) => {
            e.stopPropagation()
            onArchive(quoteId)
          }}
        >
          <Archive className="h-4 w-4" />
          Archiválás
        </button>
        {canDelete ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(quoteId)
            }}
          >
            <Trash2 className="h-4 w-4" />
            Törlés
          </button>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function QuoteListTableRow({
  row,
  selectMode,
  selected,
  contract,
  onToggleSelect,
  onOpen,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  row: QuoteListRow
  selectMode: boolean
  selected: boolean
  contract?: QuoteContractContext
  onToggleSelect: () => void
  onOpen: () => void
  onDuplicate: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { quote, summary } = row
  const trade = quoteTradeLabel(quote)
  const subtitle = secondaryQuoteTitle(trade, quote.title)
  const hasLines = summary.lineCount > 0
  const partial = summary.isPartialTotal
  const gross = grossFor(quote, summary)
  const pricing = pricingProgress(summary.pricedCount, summary.lineCount)
  const sub = subcontractorProgress({
    lineCount: summary.lineCount,
    rfqPendingCount: summary.rfqPendingCount,
    rfqCount: summary.rfqCount,
    rfqSubmissionCount: summary.rfqSubmissionCount,
    rfqAwaitingCount: summary.rfqAwaitingCount,
    unappliedSubmissionCount: summary.unappliedSubmissionCount,
  })
  const contracted = contract?.isContracted === true

  return (
    <tr
      onClick={onOpen}
      className={cn(
        "cursor-pointer border-b border-slate-100 transition-colors",
        selected && "bg-blue-50/60 hover:bg-blue-50",
        !selected && "hover:bg-slate-50/80"
      )}
    >
      {selectMode ? (
        <td className="w-12 px-3 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-400"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Kijelölés: ${trade}`}
          />
        </td>
      ) : null}

      <td className="px-4 py-4 align-middle">
        <div className="min-w-[9rem] max-w-[18rem]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold leading-snug text-slate-950 sm:text-lg">
              {trade}
            </p>
            {contracted ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-950">
                {contract?.packageType === "supplement" ? "Pótmunka" : "Szerződésben"}
              </span>
            ) : null}
            {contract?.hasDrift ? (
              <span
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950"
                title="Az élő ár eltér a kiküldött szerződéstől"
              >
                Ár eltér
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-sm text-slate-600" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-slate-600">
            {QUOTE_STATUS_LABELS[quote.status]}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 align-middle">
        <PricingProgressCell progress={pricing} size="lg" />
      </td>

      <td className="px-4 py-4 align-middle">
        <SubcontractorProgressCell progress={sub} size="lg" />
      </td>

      <td className="px-4 py-4 align-middle text-right tabular-nums">
        <span
          className={cn(
            "text-base font-bold text-slate-950 sm:text-lg",
            partial && "text-amber-950"
          )}
          title={partial ? "Részleges — vannak még árazatlan tételek" : undefined}
        >
          {formatMoney(gross, hasLines, partial)}
        </span>
      </td>

      {!selectMode ? (
        <td className="w-14 px-2 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
          <RowMenu
            quoteId={quote.id}
            canDelete={summary.rfqCount === 0}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </td>
      ) : (
        <td className="w-4" />
      )}
    </tr>
  )
}

export function QuoteListTable({
  rows,
  projectId,
  contractMap,
  onDuplicate,
  onDelete,
  onArchive,
  onStartRfq,
  onCreateOffer,
}: QuoteListTableProps) {
  const router = useRouter()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [archivedOpen, setArchivedOpen] = useState(false)

  const activeRows = useMemo(() => sortActive(rows), [rows])
  const archivedRows = useMemo(() => sortArchived(rows), [rows])
  const rowById = useMemo(() => new Map(rows.map((r) => [r.quote.id, r])), [rows])

  const selectedRows = useMemo(
    () =>
      [...selected]
        .map((id) => rowById.get(id))
        .filter((r): r is QuoteListRow => r != null && r.quote.status !== "archived"),
    [selected, rowById]
  )

  const allSelected =
    activeRows.length > 0 && activeRows.every((r) => selected.has(r.quote.id))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(activeRows.map((r) => r.quote.id)))
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const singleActiveId = selectedRows.length === 1 ? selectedRows[0].quote.id : null
  const deletableCount = selectedRows.filter((r) => r.summary.rfqCount === 0).length

  const openEditor = (quoteId: string) => {
    router.push(`/projektek/${projectId}/ajanlat/${quoteId}`)
  }

  const bulkArchive = () => {
    if (selectedRows.length === 0) return
    if (!confirm(`${selectedRows.length} szakág archiválása?`)) return
    for (const r of selectedRows) onArchive(r.quote.id)
    exitSelectMode()
  }

  const bulkDelete = () => {
    const targets = selectedRows.filter((r) => r.summary.rfqCount === 0)
    if (targets.length === 0) return
    if (!confirm(`${targets.length} szakág törlése?`)) return
    for (const r of targets) onDelete(r.quote.id)
    exitSelectMode()
  }

  const bulkDuplicate = () => {
    for (const r of selectedRows) onDuplicate(r.quote.id)
    exitSelectMode()
  }

  const colCount = selectMode ? 5 : 5

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-4 py-2">
        {selectMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 text-sm font-semibold"
              onClick={toggleAll}
              disabled={activeRows.length === 0}
            >
              {allSelected ? "Kijelölés törlése" : "Összes kijelölése"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-sm font-semibold"
              onClick={exitSelectMode}
            >
              Kijelölés vége
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-2 text-sm font-semibold text-slate-700"
            onClick={() => setSelectMode(true)}
          >
            <CheckSquare className="h-4 w-4" />
            Kijelölés
          </Button>
        )}
      </div>

      {selectMode && selected.size > 0 ? (
        <QuoteBulkToolbar
          count={selected.size}
          singleActiveId={singleActiveId}
          deletableCount={deletableCount}
          onClear={exitSelectMode}
          onArchive={bulkArchive}
          onDelete={bulkDelete}
          onDuplicate={bulkDuplicate}
          onStartRfq={() => {
            if (singleActiveId) onStartRfq(singleActiveId)
          }}
          onCreateOffer={
            onCreateOffer
              ? () => {
                  onCreateOffer([...selected])
                  exitSelectMode()
                }
              : undefined
          }
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[48rem] border-collapse">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-sm font-bold text-slate-700">
            <tr>
              {selectMode ? (
                <th className="w-12 px-3 py-3.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-400"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Összes szakág kijelölése"
                    disabled={activeRows.length === 0}
                  />
                </th>
              ) : null}
              <th className="px-4 py-3.5">Szakág</th>
              <th className="px-4 py-3.5">Árazás</th>
              <th className="px-4 py-3.5">Alvállalkozó</th>
              <th className="px-4 py-3.5 text-right">
                <span className="block">Bruttó</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-600">
                  ügyfélnek
                </span>
              </th>
              {!selectMode ? <th className="w-14 px-2 py-3.5" /> : <th className="w-4" />}
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <QuoteListTableRow
                key={row.quote.id}
                row={row}
                selectMode={selectMode}
                selected={selected.has(row.quote.id)}
                contract={contractMap?.get(row.quote.id)}
                onToggleSelect={() => toggleRow(row.quote.id)}
                onOpen={() => openEditor(row.quote.id)}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
            {activeRows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-8 text-center text-base text-slate-600"
                >
                  Nincs aktív szakág.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {archivedRows.length > 0 ? (
          <div className="border-t border-slate-200">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-base font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setArchivedOpen((o) => !o)}
            >
              <span>Archivált szakágak ({archivedRows.length})</span>
              <span className="text-sm font-medium text-slate-500">
                {archivedOpen ? "Elrejt" : "Mutat"}
              </span>
            </button>
            {archivedOpen ? (
              <table className="w-full min-w-[40rem] border-collapse">
                <tbody>
                  {archivedRows.map((row) => {
                    const trade = quoteTradeLabel(row.quote)
                    const hasLines = row.summary.lineCount > 0
                    return (
                      <tr
                        key={row.quote.id}
                        className="cursor-pointer border-t border-slate-100 bg-slate-50/80 text-slate-600 hover:bg-slate-100/80"
                        onClick={() => openEditor(row.quote.id)}
                      >
                        <td className="px-4 py-3.5 text-base font-semibold">{trade}</td>
                        <td className="px-4 py-3.5 text-sm">Archivált</td>
                        <td className="px-4 py-3.5 text-right text-base font-bold tabular-nums text-slate-800">
                          {formatMoney(grossFor(row.quote, row.summary), hasLines)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
