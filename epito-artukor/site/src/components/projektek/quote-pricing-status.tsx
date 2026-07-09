"use client"

import { pricingStatusHint, pricingStatusTitle } from "@/lib/quote-readiness-copy"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type QuotePricingStatusInput = {
  lineCount: number
  pricedCount: number
  readiness: {
    canSend: boolean
    blockers: string[]
  }
}

type QuotePricingStatusProps = {
  summary: QuotePricingStatusInput
  variant?: "badge" | "inline"
}

export function QuotePricingStatus({ summary, variant = "badge" }: QuotePricingStatusProps) {
  const title = pricingStatusTitle({
    canSend: summary.readiness.canSend,
    lineCount: summary.lineCount,
    pricedCount: summary.pricedCount,
  })
  const hint = pricingStatusHint(summary.readiness.canSend)
  const isOk = summary.readiness.canSend && summary.lineCount > 0
  const isEmpty = summary.lineCount === 0

  if (variant === "badge") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-medium",
          isEmpty && "border-slate-300 text-slate-600",
          !isEmpty && isOk && "border-emerald-300 bg-emerald-50 text-emerald-900",
          !isEmpty && !isOk && "border-amber-300 bg-amber-50 text-amber-950"
        )}
      >
        {title}
      </Badge>
    )
  }

  return (
    <div className="text-sm">
      <p className={cn("font-medium", isOk ? "text-emerald-800" : "text-amber-900")}>{title}</p>
      {!isOk && summary.readiness.blockers[0] ? (
        <p className="mt-0.5 text-amber-800">{summary.readiness.blockers[0]}</p>
      ) : null}
      {hint ? <p className="mt-0.5 text-slate-500">{hint}</p> : null}
    </div>
  )
}
