"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { QuotePriceSide } from "@/types/projects"
import type { QuoteExecutionStats } from "@/lib/quote-execution"
import { pricingStatusTitle } from "@/lib/quote-readiness-copy"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import type { QuoteSummary } from "@/lib/quote-summary"

export type QuoteEditorStatusTone = "neutral" | "success" | "warning"

export type QuoteEditorStatusChipModel = {
  label: string
  tone: QuoteEditorStatusTone
}

export function buildQuoteEditorStatusChip(opts: {
  editorTab: QuotePriceSide | "execution"
  executionStats?: QuoteExecutionStats
  lineCount: number
  pricedCount: number
  unpricedCount: number
  clientCanSend?: boolean
  marginPercent?: number | null
}): QuoteEditorStatusChipModel {
  const {
    editorTab,
    executionStats,
    lineCount,
    pricedCount,
    unpricedCount,
    clientCanSend,
    marginPercent,
  } = opts

  if (lineCount === 0) {
    return { label: "Nincs tétel", tone: "neutral" }
  }

  if (editorTab === "execution" && executionStats) {
    if (executionStats.done === executionStats.total) {
      return { label: "Mind kész", tone: "success" }
    }
    return {
      label: `${executionStats.done}/${executionStats.total} kész`,
      tone: executionStats.done > 0 ? "neutral" : "warning",
    }
  }

  if (editorTab === "sell") {
    const label = pricingStatusTitle({
      canSend: clientCanSend ?? false,
      lineCount,
      pricedCount,
    })
    return {
      label,
      tone: clientCanSend ? "success" : pricedCount === 0 ? "neutral" : "warning",
    }
  }

  if (unpricedCount > 0) {
    return { label: `${unpricedCount} hiány`, tone: "warning" }
  }

  if (editorTab === "markup") {
    if (marginPercent != null && marginPercent < getMinAcceptableMarginPercent()) {
      return { label: `Fedezet ${marginPercent}%`, tone: "warning" }
    }
    return {
      label: marginPercent != null ? `Fedezet ${marginPercent}%` : "Árazva",
      tone: "success",
    }
  }

  return { label: `${pricedCount}/${lineCount} árazva`, tone: "success" }
}

export function buildQuoteListStatusChip(summary: QuoteSummary): QuoteEditorStatusChipModel {
  if (summary.lineCount === 0) {
    return { label: "Nincs tétel", tone: "neutral" }
  }
  if (summary.unpricedCount > 0) {
    return { label: `${summary.unpricedCount} hiány`, tone: "warning" }
  }
  if (summary.unappliedSubmissionCount > 0) {
    return { label: `${summary.unappliedSubmissionCount} beírás`, tone: "warning" }
  }
  if (summary.rfqPendingCount > 0) {
    return { label: `${summary.rfqPendingCount} RFQ`, tone: "warning" }
  }
  if (summary.readiness.canSend) {
    return { label: "Árazás kész", tone: "success" }
  }
  if (summary.marginPercent != null && summary.marginPercent < getMinAcceptableMarginPercent()) {
    return { label: `Fedezet ${summary.marginPercent}%`, tone: "warning" }
  }
  return { label: "Hiányos", tone: "warning" }
}

export function QuoteEditorStatusChip({
  model,
  className,
}: {
  model: QuoteEditorStatusChipModel
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 min-w-[5.5rem] shrink-0 justify-center px-1.5 text-[10px] font-medium",
        model.tone === "neutral" && "border-slate-300 text-slate-600",
        model.tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        model.tone === "warning" && "border-amber-300 bg-amber-50 text-amber-950",
        className
      )}
    >
      {model.label}
    </Badge>
  )
}
