"use client"

import Link from "next/link"
import { ArrowRight, FilePlus2, Send } from "lucide-react"
import type { ExecutionSummary } from "@/lib/execution-summary"
import { formatHuf } from "@/lib/pricing"
import { Button } from "@/components/ui/button"

type ProjectExecutionKpisProps = {
  projectId: string
  summary: ExecutionSummary
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200/90 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-600">{sub}</p> : null}
    </div>
  )
}

export function ProjectExecutionKpis({ projectId, summary }: ProjectExecutionKpisProps) {
  if (!summary.isExecutionPhase) return null

  return (
    <section className="overflow-hidden rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-emerald-100 px-5 py-3.5">
        <h3 className="text-base font-semibold text-slate-900">Kivitelezési állapot</h3>
        <p className="mt-0.5 text-sm text-slate-600">TIG-elt összeg · hátralék · készültség</p>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="TIG-elt (bruttó)"
          value={summary.tigGrossTotal > 0 ? formatHuf(summary.tigGrossTotal) : "—"}
          sub={
            summary.tigCount > 0
              ? `${summary.tigCount} igazolás · ${summary.tigCertifiedLineCount} tétel`
              : "még nincs rögzítve"
          }
        />
        <Metric
          label="Hátralék (bruttó)"
          value={summary.contractGross > 0 ? formatHuf(summary.remainingGross) : "—"}
          sub={
            summary.contractGross > 0
              ? `${summary.tigPercentOfContract}% már igazolt`
              : undefined
          }
        />
        <Metric
          label="Készültség"
          value={
            summary.executionTotal > 0
              ? `${summary.executionDone} / ${summary.executionTotal}`
              : "—"
          }
          sub={
            summary.executionTotal > 0 ? `${summary.executionPercent}% kész` : undefined
          }
        />
        <Metric
          label="Igazolható"
          value={String(summary.eligibleTigLineCount)}
          sub="kész, még nincs TIG-ben"
        />
      </div>
    </section>
  )
}

type ProjectSupplementCalloutProps = {
  projectId: string
  summary: ExecutionSummary
  onOpenOfferTab?: () => void
}

export function ProjectSupplementCallout({
  projectId,
  summary,
  onOpenOfferTab,
}: ProjectSupplementCalloutProps) {
  if (summary.pendingSupplements.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-violet-200 bg-violet-50/50">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-950">Pótmunka / kiegészítő árajánlat</p>
          <ul className="mt-1.5 space-y-1">
            {summary.pendingSupplements.map((item) => (
              <li key={item.quoteId} className="text-xs text-violet-900">
                <span className="font-medium">{item.quoteTitle}</span>
                {item.packageStatus === "draft" ? (
                  <span className="text-violet-700"> — piszkozat árajánlat, küldésre vár</span>
                ) : item.packageStatus === "sent" ? (
                  <span className="text-violet-700"> — elküldve, elfogadásra vár</span>
                ) : (
                  <span className="text-violet-700"> — még nincs ügyfélnek küldve</span>
                )}
                {item.grossTotal ? (
                  <span className="text-violet-600"> · {formatHuf(item.grossTotal)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {summary.pendingSupplements.map((item) =>
            item.packageStatus === "draft" ? (
              <Button
                key={item.quoteId}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 border-violet-300 bg-white text-xs"
                onClick={onOpenOfferTab}
              >
                <Send className="h-3.5 w-3.5" />
                Árajánlat küldése
              </Button>
            ) : !item.packageId ? (
              <Button
                key={item.quoteId}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 border-violet-300 bg-white text-xs"
                asChild
              >
                <Link href={`/projektek/${projectId}/ajanlat/${item.quoteId}`}>
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Költségvetés
                </Link>
              </Button>
            ) : null
          )}
          <Button type="button" size="sm" className="h-8 gap-1 text-xs" asChild>
            <Link href={`/projektek/${projectId}?tab=offer`}>
              Árajánlat fül
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
