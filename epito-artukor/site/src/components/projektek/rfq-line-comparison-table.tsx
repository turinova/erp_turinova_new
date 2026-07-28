"use client"

import { Fragment, useMemo } from "react"
import type { QuoteLine, RfqInvitation, SubcontractorRfq, SubcontractorRfqSubmission } from "@/types/projects"
import { QUOTE_EXCEL_COLUMNS as COL } from "@/lib/quote-columns"
import {
  buildRfqComparisonRows,
  filterRfqComparisonRows,
  sumColumnTotals,
  sumCostTotals,
  type RfqLineBidCell,
  type RfqLineFilter,
} from "@/lib/rfq-line-comparison"
import { computePackageSubmissionTotal, getInvitationSubmission } from "@/lib/rfq-package-utils"
import { formatHuf } from "@/lib/pricing"
import { unitMap } from "@/lib/data/units-store"
import { cn } from "@/lib/utils"

/**
 * Sticky bal blokk (5 logikai oszlop = 6 cella, mert ártükör = Anyag+Díj):
 * Ssz | Szöveg | Menny | Egység | Ártükör Anyag | Ártükör Díj
 */
const L = {
  ssz: "left-0 w-10 min-w-10",
  text: "left-10 min-w-[14rem] max-w-[16rem] w-[14rem]",
  qty: "left-[16.5rem] w-16 min-w-16",
  unit: "left-[20.5rem] w-14 min-w-14",
  mirrorA: "left-[24rem] w-[3.75rem] min-w-[3.75rem]",
  mirrorD: "left-[27.75rem] w-[3.75rem] min-w-[3.75rem]",
} as const

function sticky(side: string, bg: string, edge = false) {
  return cn(
    "sticky z-[3]",
    side,
    bg,
    edge && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]"
  )
}

export type RfqLineComparisonTableProps = {
  pkg: SubcontractorRfq
  quoteLines: QuoteLine[]
  invitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
  search?: string
  lineFilter?: RfqLineFilter
  /** @deprecated — a mátrix mindig egységár-nézet */
  compact?: boolean
  visibleInvitationIds?: string[] | null
  maxHeight?: string
  footerLabel?: string
  showFooter?: boolean
  className?: string
}

function formatCellMoney(value: number): string {
  return value > 0 ? formatHuf(value) : "—"
}

function unitTone(opts: { cheapest: boolean; expensive: boolean; empty: boolean }): string {
  if (opts.empty) return "bg-slate-50/80 text-slate-400"
  if (opts.cheapest) return "bg-emerald-50 font-semibold text-emerald-950"
  if (opts.expensive) return "bg-amber-50 text-amber-950"
  return "bg-white text-slate-900"
}

function UnitTd({
  value,
  cheapest,
  expensive,
  className,
  isLastOfGroup,
}: {
  value: number
  cheapest: boolean
  expensive: boolean
  className?: string
  isLastOfGroup?: boolean
}) {
  const empty = value <= 0
  return (
    <td
      className={cn(
        "px-1.5 py-1.5 text-right tabular-nums text-[13px]",
        isLastOfGroup ? "border-r border-slate-300" : "border-r border-slate-100",
        unitTone({ cheapest, expensive, empty }),
        className
      )}
    >
      {empty ? "—" : formatHuf(value)}
    </td>
  )
}

function BidCells({ bid, cheapestCol }: { bid: RfqLineBidCell; cheapestCol: boolean }) {
  if (bid.declined) {
    return (
      <td
        colSpan={2}
        className={cn(
          "border-r border-slate-300 bg-slate-50 px-2 py-1.5 text-center text-[12px] italic text-slate-400",
          cheapestCol && "bg-slate-100"
        )}
      >
        nem vállalom
      </td>
    )
  }
  return (
    <>
      <UnitTd
        value={bid.materialUnit}
        cheapest={bid.isCheapestMaterial}
        expensive={bid.isExpensiveMaterial}
      />
      <UnitTd
        value={bid.laborUnit}
        cheapest={bid.isCheapestLabor}
        expensive={bid.isExpensiveLabor}
        isLastOfGroup
      />
    </>
  )
}

export function RfqLineComparisonTable({
  pkg,
  quoteLines,
  invitations,
  submissions,
  search = "",
  lineFilter = "all",
  visibleInvitationIds = null,
  maxHeight = "36rem",
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
      <p className="border border-dashed border-slate-200 bg-white px-3 py-3 text-center text-xs text-slate-600">
        Még nincs beküldött ajánlat az összehasonlításhoz.
      </p>
    )
  }

  const headBg = "bg-slate-100"
  const footBg = "bg-slate-100"

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden border border-slate-300 bg-white", className)}>
      <div
        className="min-h-0 flex-1 overflow-auto"
        style={maxHeight === "100%" ? undefined : { maxHeight }}
      >
        <table className="w-full min-w-[68rem] border-collapse text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-slate-300 bg-slate-100">
              <th
                rowSpan={2}
                className={cn(
                  "border-r border-slate-200 px-2 py-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-600",
                  sticky(L.ssz, headBg)
                )}
              >
                {COL.ssz}
              </th>
              <th
                rowSpan={2}
                className={cn(
                  "border-r border-slate-200 px-2 py-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-600",
                  sticky(L.text, headBg)
                )}
              >
                {COL.text}
              </th>
              <th
                rowSpan={2}
                className={cn(
                  "border-r border-slate-200 px-2 py-2 text-right align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-600",
                  sticky(L.qty, headBg)
                )}
              >
                {COL.quantity}
              </th>
              <th
                rowSpan={2}
                className={cn(
                  "border-r border-slate-200 px-2 py-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-600",
                  sticky(L.unit, headBg)
                )}
              >
                {COL.unit}
              </th>
              <th
                colSpan={2}
                className={cn(
                  "border-r-2 border-slate-400 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600",
                  sticky(L.mirrorA, headBg, true)
                )}
                style={{ left: "24rem", minWidth: "7.5rem" }}
              >
                Ártükör
              </th>
              {displayInvitations.map((inv) => {
                const isCheapest = inv.id === cheapestColumn
                return (
                  <th
                    key={inv.id}
                    colSpan={2}
                    className={cn(
                      "min-w-[9rem] border-r border-slate-300 px-2 py-1.5 text-center align-bottom",
                      isCheapest && "bg-emerald-100 ring-2 ring-inset ring-emerald-600"
                    )}
                  >
                    <span className="block text-[13px] font-semibold leading-tight text-slate-950">
                      {inv.subcontractorName}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[12px] tabular-nums",
                        isCheapest ? "font-bold text-emerald-900" : "font-medium text-slate-700"
                      )}
                    >
                      {columnTotals.get(inv.id) ? formatHuf(columnTotals.get(inv.id)!) : "—"}
                      {isCheapest ? " · legolcsóbb" : ""}
                    </span>
                  </th>
                )
              })}
            </tr>
            <tr className="border-b border-slate-300 bg-slate-50">
              <th
                className={cn(
                  "border-r border-slate-200 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500",
                  sticky(L.mirrorA, "bg-slate-50")
                )}
              >
                Anyag
              </th>
              <th
                className={cn(
                  "border-r-2 border-slate-400 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500",
                  sticky(L.mirrorD, "bg-slate-50", true)
                )}
              >
                Díj
              </th>
              {displayInvitations.map((inv) => (
                <Fragment key={`${inv.id}-h`}>
                  <th className="border-r border-slate-100 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Anyag
                  </th>
                  <th className="border-r border-slate-300 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Díj
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rfqLineId} className="border-b border-slate-200 [&_td]:align-middle">
                <td
                  className={cn(
                    "border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-500",
                    sticky(L.ssz, "bg-white")
                  )}
                >
                  {row.sectionNumber}
                </td>
                <td className={cn("border-r border-slate-100 px-2 py-1.5", sticky(L.text, "bg-white"))}>
                  <span className="block whitespace-normal break-words text-[13px] font-medium leading-snug text-slate-900">
                    {row.text}
                  </span>
                  {row.identifier && row.identifier !== "—" ? (
                    <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                      {row.identifier}
                    </span>
                  ) : null}
                </td>
                <td
                  className={cn(
                    "border-r border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-800",
                    sticky(L.qty, "bg-white")
                  )}
                >
                  {row.quantity}
                </td>
                <td
                  className={cn(
                    "border-r border-slate-100 px-2 py-1.5 text-slate-700",
                    sticky(L.unit, "bg-white")
                  )}
                >
                  {unitMap[row.unitCode]?.code ?? row.unitCode}
                </td>
                <td
                  className={cn(
                    "border-r border-slate-100 px-1.5 py-1.5 text-right tabular-nums text-slate-600",
                    sticky(L.mirrorA, "bg-white")
                  )}
                >
                  {formatCellMoney(row.costMaterialUnit)}
                </td>
                <td
                  className={cn(
                    "border-r-2 border-slate-400 px-1.5 py-1.5 text-right tabular-nums text-slate-600",
                    sticky(L.mirrorD, "bg-white", true)
                  )}
                >
                  {formatCellMoney(row.costLaborUnit)}
                </td>
                {displayInvitations.map((inv) => {
                  const bid = row.bids.find((b) => b.invitationId === inv.id)
                  const cheapestCol = inv.id === cheapestColumn
                  if (!bid) {
                    return (
                      <Fragment key={inv.id}>
                        <td className="border-r border-slate-100 px-1.5 py-1.5 text-right text-slate-400">
                          —
                        </td>
                        <td className="border-r border-slate-300 px-1.5 py-1.5 text-right text-slate-400">
                          —
                        </td>
                      </Fragment>
                    )
                  }
                  return (
                    <Fragment key={inv.id}>
                      <BidCells bid={bid} cheapestCol={cheapestCol} />
                    </Fragment>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {showFooter ? (
            <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-400 text-[13px] font-semibold shadow-[0_-2px_6px_rgba(0,0,0,0.08)]">
              <tr className="bg-slate-100">
                <td className={cn("px-2 py-2", sticky(L.ssz, footBg))} />
                <td className={cn("px-2 py-2", sticky(L.text, footBg))} colSpan={1}>
                  Összesen ({rows.length})
                </td>
                <td className={cn(sticky(L.qty, footBg))} />
                <td className={cn(sticky(L.unit, footBg))} />
                <td
                  colSpan={2}
                  className={cn(
                    "border-r-2 border-slate-400 px-2 py-2 text-right tabular-nums",
                    sticky(L.mirrorA, footBg, true)
                  )}
                  style={{ left: "24rem", minWidth: "7.5rem" }}
                >
                  {formatCellMoney(costTotals.total)}
                </td>
                {displayInvitations.map((inv) => {
                  const col = sumColumnTotals(rows, inv.id)
                  const isCheapest = inv.id === cheapestColumn && col.total > 0
                  return (
                    <td
                      key={inv.id}
                      colSpan={2}
                      className={cn(
                        "border-r border-slate-300 px-2 py-2 text-center tabular-nums",
                        isCheapest ? "bg-emerald-100 text-emerald-950" : footBg
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
      <p className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
        Zöld = legolcsóbb egységár · Borostyán = +15%-nál drágább · Keretes oszlop = legalacsonyabb
        csomagösszeg
      </p>
    </div>
  )
}
