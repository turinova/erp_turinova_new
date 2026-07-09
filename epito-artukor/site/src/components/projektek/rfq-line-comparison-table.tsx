"use client"

import { useMemo } from "react"
import type { QuoteLine, RfqInvitation, SubcontractorRfq, SubcontractorRfqSubmission } from "@/types/projects"
import { QUOTE_EXCEL_COLUMNS as COL } from "@/lib/quote-columns"
import {
  buildRfqComparisonRows,
  filterRfqComparisonRows,
  sumColumnTotals,
  sumCostTotals,
  type RfqComparisonRow,
  type RfqLineFilter,
} from "@/lib/rfq-line-comparison"
import { computePackageSubmissionTotal, getInvitationSubmission } from "@/lib/rfq-package-utils"
import { formatHuf } from "@/lib/pricing"
import { unitMap } from "@/lib/data/units-store"
import { QuoteTableFooterSummary } from "@/components/projektek/quote-table-footer-summary"
import { cn } from "@/lib/utils"

const STICKY_BG = "bg-white"
const STICKY_HEAD = "bg-slate-50"
const STICKY_FOOT = "bg-slate-100"

const stickySsz = `sticky left-0 z-[3] w-10 min-w-10 ${STICKY_BG} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
const stickyId = `sticky left-10 z-[3] w-24 min-w-24 ${STICKY_BG} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
const stickyText = `sticky left-[8.5rem] z-[3] min-w-[12rem] max-w-md ${STICKY_BG} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
const stickyHeadSsz = `sticky left-0 z-[3] w-10 min-w-10 ${STICKY_HEAD} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
const stickyHeadId = `sticky left-10 z-[3] w-24 min-w-24 ${STICKY_HEAD} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
const stickyHeadText = `sticky left-[8.5rem] z-[3] min-w-[12rem] max-w-md ${STICKY_HEAD} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
const stickyFootSsz = `sticky left-0 z-[3] w-10 min-w-10 ${STICKY_FOOT} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`

export type RfqLineComparisonTableProps = {
  pkg: SubcontractorRfq
  quoteLines: QuoteLine[]
  invitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
  search?: string
  lineFilter?: RfqLineFilter
  compact?: boolean
  /** Csak ezek az alvállalkozó oszlopok (összehasonlítás párosítás) */
  visibleInvitationIds?: string[] | null
  maxHeight?: string
  footerLabel?: string
  showFooter?: boolean
  className?: string
}

function formatCellMoney(value: number): string {
  return value > 0 ? formatHuf(value) : "—"
}

function SubBidCell({
  bid,
  compact,
}: {
  bid: RfqComparisonRow["bids"][number]
  compact: boolean
}) {
  if (bid.declined || bid.lineTotal == null) {
    return <span className="text-slate-400">—</span>
  }
  return (
    <div
      className={cn(
        bid.isCheapest && "font-semibold text-emerald-900",
        !bid.isCheapest && "text-slate-900"
      )}
    >
      <div>{formatHuf(bid.lineTotal)}</div>
      {!compact ? (
        <div className="text-[10px] font-normal text-slate-500">
          A: {formatHuf(bid.materialTotal)} · D: {formatHuf(bid.laborTotal)}
        </div>
      ) : null}
    </div>
  )
}

export function RfqLineComparisonTable({
  pkg,
  quoteLines,
  invitations,
  submissions,
  search = "",
  lineFilter = "all",
  compact = true,
  visibleInvitationIds = null,
  maxHeight = "28rem",
  footerLabel = "Összesítő",
  showFooter = true,
  className,
}: RfqLineComparisonTableProps) {
  const submittedInvitations = useMemo(
    () => invitations.filter((inv) => submissions.some((s) => s.invitationId === inv.id)),
    [invitations, submissions]
  )

  const displayInvitations = useMemo(() => {
    if (!visibleInvitationIds?.length) return submittedInvitations
    return submittedInvitations.filter((inv) => visibleInvitationIds.includes(inv.id))
  }, [submittedInvitations, visibleInvitationIds])

  const quoteLineOrder = useMemo(() => {
    const map = new Map<string, number>()
    quoteLines.forEach((l, i) => map.set(l.id, i))
    return map
  }, [quoteLines])

  const allRows = useMemo(
    () =>
      buildRfqComparisonRows(pkg, quoteLines, submittedInvitations, submissions, quoteLineOrder).sort(
        (a, b) => a.rowIndex - b.rowIndex
      ),
    [pkg, quoteLines, submittedInvitations, submissions, quoteLineOrder]
  )

  const rows = useMemo(
    () => filterRfqComparisonRows(allRows, search, lineFilter),
    [allRows, search, lineFilter]
  )

  const costTotals = useMemo(() => sumCostTotals(rows), [rows])

  const columnTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of displayInvitations) {
      const sub = getInvitationSubmission(inv.id, submissions)
      map.set(inv.id, sub ? computePackageSubmissionTotal(sub, pkg) : 0)
    }
    return map
  }, [displayInvitations, submissions, pkg])

  const cheapestColumn = useMemo(() => {
    let best: string | null = null
    let bestVal = Infinity
    for (const [id, total] of columnTotals) {
      if (total > 0 && total < bestVal) {
        bestVal = total
        best = id
      }
    }
    return best
  }, [columnTotals])

  if (submittedInvitations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-white px-4 py-6 text-center text-sm text-slate-600">
        Még nincs beküldött ajánlat az összehasonlításhoz.
      </p>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <div
        className="min-h-0 flex-1 overflow-auto"
        style={maxHeight === "100%" ? undefined : { maxHeight }}
      >
        <table className="w-full min-w-[56rem] border-collapse text-xs">
          <thead className="ea-table-head sticky top-0 z-20 text-xs shadow-sm">
            <tr>
              <th className={cn("px-2 py-1.5 text-left", stickyHeadSsz)}>{COL.ssz}</th>
              <th className={cn("px-2 py-1.5 text-left", stickyHeadId)}>{COL.identifier}</th>
              <th className={cn("px-2 py-1.5 text-left", stickyHeadText)}>{COL.text}</th>
              <th className="px-2 py-1.5 text-right">{COL.quantity}</th>
              <th className="px-2 py-1.5">{COL.unit}</th>
              {!compact ? (
                <>
                  <th className="px-2 py-1.5 text-right">{COL.materialUnit}</th>
                  <th className="px-2 py-1.5 text-right">{COL.laborUnit}</th>
                </>
              ) : null}
              <th className="px-2 py-1.5 text-right">{COL.materialTotal}</th>
              <th className="px-2 py-1.5 text-right">{COL.laborTotal}</th>
              <th className="px-2 py-1.5 text-right">Össz.</th>
              <th className="px-2 py-1.5 text-right text-slate-500">Ártükör</th>
              {displayInvitations.map((inv) => (
                <th
                  key={inv.id}
                  className="min-w-[6.5rem] px-2 py-1.5 text-right align-bottom"
                >
                  <span className="block font-semibold leading-tight">{inv.subcontractorName}</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    {columnTotals.get(inv.id) ? formatHuf(columnTotals.get(inv.id)!) : "—"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ql = quoteLines.find((l) => l.id === row.quoteLineId)
              const matUnit =
                ql && ql.quantity > 0 ? Math.round(row.costMaterialTotal / ql.quantity) : 0
              const labUnit =
                ql && ql.quantity > 0 ? Math.round(row.costLaborTotal / ql.quantity) : 0

              return (
                <tr
                  key={row.rfqLineId}
                  className={cn(
                    "border-b border-slate-100 hover:bg-slate-50/80 [&_td]:align-top",
                    row.hasBidDifference && "bg-amber-50/20"
                  )}
                >
                  <td className={cn("px-2 py-1.5 tabular-nums text-slate-600", stickySsz)}>
                    {row.sectionNumber}
                  </td>
                  <td className={cn("px-2 py-1.5 font-code font-medium text-blue-700", stickyId)}>
                    {row.identifier}
                  </td>
                  <td className={cn("px-2 py-1.5", stickyText)}>
                    <span className="block whitespace-normal break-words leading-snug text-slate-900">
                      {row.text}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                    {row.quantity}
                  </td>
                  <td className="px-2 py-1.5 text-slate-700">
                    {unitMap[row.unitCode]?.code ?? row.unitCode}
                  </td>
                  {!compact ? (
                    <>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                        {formatCellMoney(matUnit)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                        {formatCellMoney(labUnit)}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                    {formatCellMoney(row.costMaterialTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                    {formatCellMoney(row.costLaborTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums text-slate-900">
                    {formatCellMoney(row.costTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                    {row.catalogTotal > 0 ? formatHuf(row.catalogTotal) : "—"}
                  </td>
                  {displayInvitations.map((inv) => {
                    const bid = row.bids.find((b) => b.invitationId === inv.id)
                    if (!bid) return <td key={inv.id} className="px-2 py-1.5 text-right" />
                    return (
                      <td
                        key={inv.id}
                        className={cn(
                          "px-2 py-1.5 text-right tabular-nums",
                          bid.isCheapest && bid.lineTotal != null && "bg-emerald-50/80"
                        )}
                      >
                        <SubBidCell bid={bid} compact={compact} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {showFooter ? (
            <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 text-xs font-semibold shadow-[0_-2px_6px_rgba(0,0,0,0.08)]">
              <tr>
                <td className={cn("px-2 py-2", stickyFootSsz)} colSpan={compact ? 5 : 7}>
                  Összesen ({rows.length} sor)
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatCellMoney(costTotals.material)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatCellMoney(costTotals.labor)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatCellMoney(costTotals.total)}</td>
                <td className="px-2 py-2" />
                {displayInvitations.map((inv) => {
                  const col = sumColumnTotals(rows, inv.id)
                  const isCheapest = inv.id === cheapestColumn && col.total > 0
                  return (
                    <td
                      key={inv.id}
                      className={cn(
                        "px-2 py-2 text-right tabular-nums",
                        isCheapest && "text-emerald-900"
                      )}
                    >
                      {col.total > 0 ? formatHuf(col.total) : "—"}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Nincs tétel a szűrőnek megfelelően.</p>
        ) : null}
      </div>
      {showFooter && rows.length > 0 ? (
        <QuoteTableFooterSummary
          label={footerLabel}
          cells={displayInvitations.slice(0, 3).map((inv, idx) => {
            const total = columnTotals.get(inv.id) ?? 0
            const tones: Array<"emerald" | "blue" | "amber"> = ["emerald", "blue", "amber"]
            return {
              label: inv.subcontractorName,
              value: total > 0 ? formatHuf(total) : "—",
              tone: inv.id === cheapestColumn ? "emerald" : tones[idx % 3],
              emphasis: inv.id === cheapestColumn,
            }
          })}
        />
      ) : null}
    </div>
  )
}
