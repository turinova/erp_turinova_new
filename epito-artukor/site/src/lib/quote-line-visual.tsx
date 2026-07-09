"use client"

import type { QuoteLine } from "@/types/projects"
import { COST_SOURCE_LABELS, isLineCosted } from "@/lib/quote-pricing"
import { cn } from "@/lib/utils"

export type QuoteLineVisualKind =
  | "unpriced"
  | "rfq_pending"
  | "subcontractor"
  | "catalog"
  | "manual"

export type CostSourceFilter =
  | "all"
  | "subcontractor"
  | "estimated"
  | "unpriced"
  | "rfq_pending"

export function getQuoteLineVisualKind(line: QuoteLine): QuoteLineVisualKind {
  if (line.pricingStatus === "rfq_pending") return "rfq_pending"
  if (!isLineCosted(line) || line.costSource === "unpriced") return "unpriced"
  if (line.costSource === "subcontractor") return "subcontractor"
  if (line.costSource === "catalog") return "catalog"
  return "manual"
}

export function getQuoteLineRowClass(kind: QuoteLineVisualKind): string {
  switch (kind) {
    case "subcontractor":
      return "border-l-4 border-l-emerald-500 bg-emerald-50/50 hover:bg-emerald-50/80"
    case "rfq_pending":
      return "border-l-4 border-l-blue-500 bg-blue-50/40 hover:bg-blue-50/60"
    case "unpriced":
      return "border-l-4 border-l-amber-400 bg-amber-50/40 hover:bg-amber-50/60"
    case "catalog":
      return "border-l-4 border-l-slate-300 bg-slate-50/50 hover:bg-slate-50/80"
    case "manual":
      return "border-l-4 border-l-slate-400 bg-white hover:bg-slate-50/80"
  }
}

export function matchesCostSourceFilter(
  line: QuoteLine,
  filter: CostSourceFilter
): boolean {
  const kind = getQuoteLineVisualKind(line)
  switch (filter) {
    case "all":
      return true
    case "subcontractor":
      return kind === "subcontractor"
    case "estimated":
      return kind === "catalog" || kind === "manual"
    case "unpriced":
      return kind === "unpriced"
    case "rfq_pending":
      return kind === "rfq_pending"
  }
}

export function countLinesByVisualKind(lines: QuoteLine[]): Record<QuoteLineVisualKind, number> {
  const counts: Record<QuoteLineVisualKind, number> = {
    unpriced: 0,
    rfq_pending: 0,
    subcontractor: 0,
    catalog: 0,
    manual: 0,
  }
  for (const line of lines) {
    counts[getQuoteLineVisualKind(line)] += 1
  }
  return counts
}

export function costSourceKindDotClass(kind: QuoteLineVisualKind | "all"): string {
  switch (kind) {
    case "subcontractor":
      return "bg-emerald-500"
    case "rfq_pending":
      return "bg-blue-500"
    case "unpriced":
      return "bg-amber-400"
    case "catalog":
      return "bg-slate-300"
    case "manual":
      return "bg-slate-400"
    default:
      return "bg-slate-300"
  }
}

export function costSourceFilterDotKind(filter: CostSourceFilter): QuoteLineVisualKind | "all" {
  switch (filter) {
    case "subcontractor":
      return "subcontractor"
    case "estimated":
      return "catalog"
    case "rfq_pending":
      return "rfq_pending"
    case "unpriced":
      return "unpriced"
    default:
      return "all"
  }
}

type QuoteLineSourceIconProps = {
  line: QuoteLine
  submittedAt?: string | null
  compact?: boolean
}

export function QuoteLineSourceIcon({ line, submittedAt, compact = true }: QuoteLineSourceIconProps) {
  const kind = getQuoteLineVisualKind(line)

  if (kind === "subcontractor" && line.costSourceSubcontractor) {
    const name = line.costSourceSubcontractor
    const short =
      name.length > 10 && compact ? `${name.slice(0, 9)}…` : name
    const title = submittedAt
      ? `${name} · ${new Date(submittedAt).toLocaleDateString("hu-HU")}`
      : name
    return (
      <span
        title={title}
        className="inline-block max-w-[5.5rem] truncate text-xs font-medium text-emerald-800"
      >
        {short}
      </span>
    )
  }

  const labels: Record<QuoteLineVisualKind, string> = {
    rfq_pending: "Vár",
    unpriced: "—",
    catalog: "Bec",
    manual: "Kézi",
    subcontractor: "Alv",
  }

  const titles: Record<QuoteLineVisualKind, string> = {
    rfq_pending: "Vár alvállalkozóra",
    unpriced: "Árazatlan",
    catalog: "Ártükör / becsült",
    manual: "Kézi bevitel",
    subcontractor: "Alvállalkozói",
  }

  return (
    <span
      title={titles[kind]}
      className={cn(
        "text-xs font-medium",
        kind === "rfq_pending" && "text-blue-800",
        kind === "unpriced" && "text-amber-800",
        (kind === "catalog" || kind === "manual") && "text-slate-600"
      )}
    >
      {labels[kind]}
    </span>
  )
}

type QuoteLineSourceBadgeProps = {
  line: QuoteLine
  submittedAt?: string | null
}

export function QuoteLineSourceBadge({ line, submittedAt }: QuoteLineSourceBadgeProps) {
  const kind = getQuoteLineVisualKind(line)

  if (kind === "subcontractor" && line.costSourceSubcontractor) {
    return (
      <div className="space-y-0.5">
        <span className="inline-flex max-w-[10rem] items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
          <span className="whitespace-normal break-words leading-snug">
            {line.costSourceSubcontractor}
          </span>
        </span>
        {submittedAt ? (
          <p className="text-sm text-emerald-800">
            {new Date(submittedAt).toLocaleDateString("hu-HU")}
          </p>
        ) : null}
      </div>
    )
  }

  if (kind === "rfq_pending") {
    return (
      <span className="inline-flex rounded-full border border-blue-200 bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900">
        Várakozik…
      </span>
    )
  }

  if (kind === "unpriced") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
        Árazatlan
      </span>
    )
  }

  if (kind === "catalog") {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        {COST_SOURCE_LABELS.catalog}
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
      {COST_SOURCE_LABELS.manual}
    </span>
  )
}

export function CostSourceLegend() {
  const items: { kind: QuoteLineVisualKind; label: string }[] = [
    { kind: "subcontractor", label: "Alvállalkozói ajánlat" },
    { kind: "rfq_pending", label: "Vár alvállalkozóra" },
    { kind: "catalog", label: "Ártükör / becsült" },
    { kind: "manual", label: "Kézi bevitel" },
    { kind: "unpriced", label: "Árazatlan" },
  ]

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
      {items.map(({ kind, label }) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-3 w-1 rounded-full",
              kind === "subcontractor" && "bg-emerald-500",
              kind === "rfq_pending" && "bg-blue-500",
              kind === "unpriced" && "bg-amber-400",
              kind === "catalog" && "bg-slate-300",
              kind === "manual" && "bg-slate-400"
            )}
          />
          {label}
        </span>
      ))}
    </div>
  )
}

export function subcontractorPriceInputClass(line: QuoteLine): string {
  return getQuoteLineVisualKind(line) === "subcontractor"
    ? "border-emerald-300 bg-emerald-50/80 focus-visible:ring-emerald-400"
    : ""
}
