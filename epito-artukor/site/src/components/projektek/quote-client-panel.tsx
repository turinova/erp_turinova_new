"use client"

import { useMemo } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"
import type { Quote, QuoteLine, QuoteVatMode } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import {
  QUOTE_VAT_OPTIONS,
  buildQuoteTradeBreakdown,
  calcQuoteVatTotals,
  resolveQuoteVatMode,
  type ClientQuoteReadiness,
} from "@/lib/quote-client-summary"
import { isLineCosted, lineSellTotal } from "@/lib/quote-pricing"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { unitMap } from "@/lib/data/units-store"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type QuoteClientSubView = "summary" | "lines"

type QuoteClientPanelProps = {
  quote: Quote
  lines: QuoteLine[]
  displayLines: QuoteLine[]
  subView: QuoteClientSubView
  onSubViewChange: (view: QuoteClientSubView) => void
  projectId: string
  readiness: ClientQuoteReadiness | null
  contractPriceLocked?: boolean
  readOnly?: boolean
  onVatChange: (mode: QuoteVatMode) => void
  onGoToCost: () => void
  onGoToMarkup: () => void
}

type BlockerAction = {
  text: string
  actionLabel: string
  onAction: () => void
}

function classifyBlockers(
  blockers: string[],
  onGoToCost: () => void,
  onGoToMarkup: () => void
): BlockerAction[] {
  return blockers.map((text) => {
    const lower = text.toLowerCase()
    if (lower.includes("fedezet") || lower.includes("margin")) {
      return { text, actionLabel: "Fedezet fül", onAction: onGoToMarkup }
    }
    return { text, actionLabel: "Bekerülés fül", onAction: onGoToCost }
  })
}

export function QuoteClientPanel({
  quote,
  lines,
  displayLines,
  subView,
  onSubViewChange,
  projectId,
  readiness,
  contractPriceLocked = false,
  readOnly = false,
  onVatChange,
  onGoToCost,
  onGoToMarkup,
}: QuoteClientPanelProps) {
  const breakdown = useMemo(() => buildQuoteTradeBreakdown(quote, lines), [quote, lines])
  const vatMode = resolveQuoteVatMode(quote)
  const vatTotals = useMemo(
    () => calcQuoteVatTotals(breakdown.totals.sellNetTotal, vatMode),
    [breakdown.totals.sellNetTotal, vatMode]
  )

  const minMargin = getMinAcceptableMarginPercent()
  const canSend = readiness?.canSend === true
  const blockers = readiness?.blockers ?? []
  const blockerActions = useMemo(
    () => classifyBlockers(blockers, onGoToCost, onGoToMarkup),
    [blockers, onGoToCost, onGoToMarkup]
  )

  const showTradeSummary = breakdown.rows.length > 1
  const effectiveSubView =
    subView === "summary" && !showTradeSummary ? "lines" : subView

  const unpricedCount = breakdown.totals.unpricedCount
  const statusLabel = canSend
    ? "Küldhető"
    : blockers.length > 0
      ? blockers[0]
      : "Ellenőrzés alatt"

  const vatDisabled = readOnly || contractPriceLocked

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Hero */}
      <div
        className={cn(
          "shrink-0 rounded-lg border px-4 py-3 shadow-sm",
          canSend && "border-emerald-200 bg-emerald-50/70",
          !canSend && blockers.length > 0 && "border-amber-200 bg-amber-50/80",
          !canSend && blockers.length === 0 && "border-slate-200 bg-white"
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600">Ügyfél fizet</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-slate-950">
              {formatHuf(vatTotals.grossTotal)}
              <span className="ml-2 text-base font-semibold text-slate-600">bruttó</span>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600">
              <span>
                Nettó{" "}
                <strong className="tabular-nums text-slate-800">
                  {formatHuf(vatTotals.netTotal)}
                </strong>
              </span>
              {vatTotals.showVatAmount ? (
                <span>
                  {vatTotals.vatLabel}{" "}
                  <strong className="tabular-nums text-slate-800">
                    {formatHuf(vatTotals.vatAmount)}
                  </strong>
                </span>
              ) : (
                <span>{vatTotals.vatLabel}</span>
              )}
              {breakdown.totals.marginPercent != null ? (
                <span>
                  Marad nekem{" "}
                  <strong className="tabular-nums text-slate-800">
                    {breakdown.totals.marginPercent}%
                  </strong>
                  {breakdown.totals.marginPercent < minMargin ? (
                    <span className="text-amber-800"> (cél: {minMargin}%)</span>
                  ) : null}
                </span>
              ) : null}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex max-w-xs shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-semibold",
              canSend
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-950"
            )}
          >
            {canSend ? (
              statusLabel
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{statusLabel}</span>
              </span>
            )}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">ÁFA</span>
            <Select
              value={vatMode}
              onValueChange={(v) => onVatChange(v as QuoteVatMode)}
              disabled={vatDisabled}
            >
              <SelectTrigger className="h-9 w-[14rem] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_VAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!contractPriceLocked ? (
            <Button
              asChild
              size="sm"
              className="h-9 px-4 text-sm"
              disabled={!canSend}
              title={
                canSend
                  ? "Tovább az árajánlat csomag összeállításához"
                  : "Előbb oldd meg a hiányokat"
              }
            >
              <Link
                href={
                  canSend
                    ? `/projektek/${projectId}?tab=offer`
                    : `#`
                }
                onClick={(e) => {
                  if (!canSend) e.preventDefault()
                }}
                aria-disabled={!canSend}
                className={cn(!canSend && "pointer-events-none opacity-50")}
              >
                Küldésre kész — árajánlat összeállítása
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        {vatTotals.vatNote ? (
          <p className="mt-2 text-sm text-slate-600">{vatTotals.vatNote}</p>
        ) : null}
      </div>

      {contractPriceLocked ? (
        <div className="shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800">
          <strong>Szerződéses ügyfélár — csak megtekintés.</strong> Módosításhoz használd a felső
          sávot: új árajánlat az ügyfélnek, vagy pótmunka.
        </div>
      ) : null}

      {/* Blockers */}
      {!canSend && blockerActions.length > 0 && !contractPriceLocked ? (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">Mielőtt küldenéd</p>
          <ul className="mt-2 space-y-2">
            {blockerActions.map((b) => (
              <li
                key={b.text}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-950"
              >
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  {b.text}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-amber-300 bg-white px-3 text-sm text-amber-950 hover:bg-amber-100"
                  onClick={b.onAction}
                >
                  {b.actionLabel}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <Button
            type="button"
            size="sm"
            variant={effectiveSubView === "lines" ? "secondary" : "ghost"}
            className="h-9 px-3 text-sm"
            onClick={() => onSubViewChange("lines")}
          >
            Tételek
          </Button>
          {showTradeSummary ? (
            <Button
              type="button"
              size="sm"
              variant={effectiveSubView === "summary" ? "secondary" : "ghost"}
              className="h-9 px-3 text-sm"
              onClick={() => onSubViewChange("summary")}
            >
              Szakágak szerint
            </Button>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-3 text-sm text-slate-600"
          onClick={onGoToMarkup}
        >
          Fedezet részletei
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>

        {unpricedCount > 0 ? (
          <span className="text-sm font-medium text-amber-800">
            {unpricedCount} árazatlan tétel
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          {effectiveSubView === "summary" ? (
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="ea-table-head sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2.5 text-left text-sm font-bold">Szakág</th>
                  <th className="px-3 py-2.5 text-right text-sm font-bold">Tételek</th>
                  <th className="px-3 py-2.5 text-right text-sm font-bold">Nettó</th>
                  <th className="px-3 py-2.5 text-right text-sm font-bold">Arány</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-base text-slate-500">
                      {breakdown.totals.lineCount === 0
                        ? "Nincs tétel az árajánlatban."
                        : "Minden tétel árazatlan — nincs megjeleníthető összeg."}
                    </td>
                  </tr>
                ) : (
                  breakdown.rows.map((row) => (
                    <tr
                      key={row.trade}
                      className="border-b border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          {row.label}
                          {row.marginLow ? (
                            <span title="Alacsony fedezet ezen a szakágon">
                              <AlertTriangle
                                className="h-4 w-4 text-amber-600"
                                aria-hidden
                              />
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {row.lineCount}
                        {row.unpricedCount > 0 ? (
                          <span className="text-amber-800">
                            {" "}
                            ({row.unpricedCount} árazatlan)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right text-base font-semibold tabular-nums text-blue-900">
                        {formatHuf(row.sellNetTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {row.sharePercent != null ? `${row.sharePercent}%` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="ea-table-head sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="w-12 px-3 py-2.5 text-left text-sm font-bold">Ssz.</th>
                  <th className="px-3 py-2.5 text-left text-sm font-bold">Tétel</th>
                  <th className="px-3 py-2.5 text-right text-sm font-bold">Mennyiség</th>
                  <th className="px-3 py-2.5 text-right text-sm font-bold">Nettó / egység</th>
                  <th className="px-3 py-2.5 text-right text-sm font-bold">Nettó összesen</th>
                </tr>
              </thead>
              <tbody>
                {displayLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-base text-slate-500">
                      Nincs megjeleníthető tétel.
                    </td>
                  </tr>
                ) : (
                  displayLines.map((line, i) => {
                    const costed = isLineCosted(line)
                    const sellTotal = costed ? lineSellTotal(line, quote) : 0
                    const unitNet =
                      costed && line.quantity > 0
                        ? Math.round(sellTotal / line.quantity)
                        : null
                    const unitLabel = unitMap[line.unitId]?.code ?? ""

                    return (
                      <tr
                        key={line.id}
                        className={cn(
                          "border-b border-slate-100 hover:bg-slate-50/80",
                          !costed && "bg-amber-50/40"
                        )}
                      >
                        <td className="px-3 py-2.5 font-code font-semibold tabular-nums text-slate-600">
                          {i + 1}
                        </td>
                        <td className="min-w-[14rem] max-w-lg px-3 py-2.5">
                          <p className="font-code text-[13px] font-semibold text-blue-800">
                            {line.identifierSnapshot}
                          </p>
                          <p className="mt-0.5 whitespace-normal break-words text-sm leading-snug text-slate-900">
                            {line.textSnapshot}
                          </p>
                          {!costed ? (
                            <p className="mt-1 text-sm font-semibold text-amber-800">
                              Nincs bekerülés — előbb a Bekerülés fül
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {line.quantity} {unitLabel}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                          {unitNet != null ? formatHuf(unitNet) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-base font-semibold tabular-nums text-blue-900">
                          {costed ? formatHuf(sellTotal) : "—"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {displayLines.length > 0 || breakdown.rows.length > 0 ? (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm font-medium text-slate-600">
                {effectiveSubView === "summary" ? "Szakágak összesen" : "Tételek összesen"}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="text-slate-600">
                  Nettó{" "}
                  <strong className="tabular-nums text-slate-900">
                    {formatHuf(vatTotals.netTotal)}
                  </strong>
                </span>
                {vatTotals.showVatAmount ? (
                  <span className="text-slate-600">
                    {vatTotals.vatLabel}{" "}
                    <strong className="tabular-nums text-amber-900">
                      {formatHuf(vatTotals.vatAmount)}
                    </strong>
                  </span>
                ) : null}
                <span className="text-slate-600">
                  Bruttó{" "}
                  <strong className="text-base tabular-nums text-blue-900">
                    {formatHuf(vatTotals.grossTotal)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <p className="shrink-0 text-sm text-slate-500">
        Ez az <strong className="font-medium text-slate-700">ügyfélnek szóló előnézet</strong> —
        bekerülés és ráterhelés itt nem látszik. A belső fedezet a Fedezet fülön van.
      </p>
    </div>
  )
}
