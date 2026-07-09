"use client"

import { ChevronDown } from "lucide-react"
import type { QuoteLine } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import { getQuoteLineRfqContexts } from "@/lib/quote-rfq-context"
import { unitMap } from "@/lib/data/units-store"
import { cn } from "@/lib/utils"

const TABLE_COLS = 12

type QuoteLineBidExpandProps = {
  line: QuoteLine
  quoteId: string
  allLines: QuoteLine[]
  expanded: boolean
  onToggle: () => void
  colSpan?: number
}

function formatUnitPrice(value: number): string {
  return value > 0 ? formatHuf(value) : "—"
}

export function QuoteLineBidExpandRow({
  line,
  quoteId,
  allLines,
  expanded,
  onToggle,
}: QuoteLineBidExpandProps) {
  const contexts = getQuoteLineRfqContexts(line.id, quoteId, allLines)
  const active = contexts.filter((c) => c.offers.length > 0 || c.needsDecision)
  if (active.length === 0) return null

  const primary = active[0]
  const bidCount = primary.submissionCount
  const label =
    bidCount > 0
      ? `${bidCount} alvállalkozói ajánlat${primary.awaitingCount > 0 ? ` · ${primary.awaitingCount} vár` : ""}`
      : "Vár alvállalkozóra"

  const unitCode = unitMap[line.unitId]?.code ?? line.unitId
  const multiplePackages = active.length > 1

  return (
    <>
      <tr className={cn("border-b bg-blue-50/40", expanded && "border-b-0")}>
        <td colSpan={2} className="px-2 py-0.5" />
        <td colSpan={TABLE_COLS - 2} className="px-2 py-0.5">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 py-0.5 text-left text-[11px] text-blue-900 hover:text-blue-950"
            onClick={onToggle}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
            />
            <span className="font-medium">{label}</span>
            <span className="truncate text-blue-700">— {primary.packageTitle}</span>
          </button>
        </td>
      </tr>
      {expanded
        ? active.flatMap((ctx) => {
            const rows = ctx.offers.map((offer) => (
              <tr
                key={`${ctx.packageId}-${offer.submissionId}`}
                className={cn(
                  "border-b border-blue-100/80 bg-blue-50/25 text-xs [&_td]:align-top",
                  offer.isCheapest && offer.lineTotal > 0 && "bg-emerald-50/70"
                )}
              >
                <td className="px-2 py-1" />
                <td className="px-2 py-1" />
                <td className="min-w-[12rem] max-w-md px-2 py-1">
                  <div className="border-l-2 border-blue-300 pl-2">
                    <span className="font-medium text-slate-800">{offer.subcontractorName}</span>
                    {multiplePackages ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">{ctx.packageTitle}</p>
                    ) : null}
                    {offer.isCheapest && offer.lineTotal > 0 ? (
                      <p className="mt-0.5 text-[10px] font-medium text-emerald-800">
                        Legolcsóbb
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                  {line.quantity}
                </td>
                <td className="px-2 py-1 text-slate-600">{unitCode}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-800">
                  {offer.declined ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    formatUnitPrice(offer.materialUnitPrice)
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-800">
                  {offer.declined ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    formatUnitPrice(offer.laborUnitPrice)
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                  {offer.declined ? "—" : formatUnitPrice(offer.materialTotal)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                  {offer.declined ? "—" : formatUnitPrice(offer.laborTotal)}
                </td>
                <td className="px-2 py-1 text-right font-medium tabular-nums text-slate-900">
                  {offer.declined ? (
                    <span className="font-normal text-slate-400">Nem vállalja</span>
                  ) : (
                    formatHuf(offer.lineTotal)
                  )}
                </td>
                <td className="w-14 px-2 py-1 text-[10px] text-blue-800">Ajánlat</td>
                <td className="px-1 py-1" />
              </tr>
            ))

            if (ctx.awaitingCount > 0) {
              rows.push(
                <tr key={`${ctx.packageId}-awaiting`} className="border-b bg-blue-50/15">
                  <td colSpan={2} className="px-2 py-1" />
                  <td colSpan={TABLE_COLS - 2} className="px-2 py-1 text-[10px] text-slate-500">
                    +{ctx.awaitingCount} meghívott még nem küldött ajánlatot
                    {multiplePackages ? ` (${ctx.packageTitle})` : ""}
                  </td>
                </tr>
              )
            }

            return rows
          })
        : null}
      {expanded ? (
        <tr className="border-b bg-blue-50/20">
          <td colSpan={2} className="px-2 pb-1.5" />
          <td colSpan={TABLE_COLS - 2} className="px-2 pb-1.5 text-[10px] text-slate-500">
            A nyertes kiválasztása a teljes bekérésre vonatkozik — „Összehasonlítás és döntés”.
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function lineHasRfqBids(line: QuoteLine, quoteId: string, allLines: QuoteLine[]): boolean {
  const contexts = getQuoteLineRfqContexts(line.id, quoteId, allLines)
  return contexts.some((c) => c.needsDecision || c.offers.length > 0)
}
