import type { QuoteLine } from "@/types/projects"
import { PRICING_STATUS_LABELS, COST_SOURCE_LABELS } from "@/lib/quote-pricing"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_VARIANT: Record<
  QuoteLine["pricingStatus"],
  "secondary" | "warning" | "default" | "success"
> = {
  unpriced: "warning",
  estimated: "secondary",
  rfq_pending: "default",
  costed: "success",
}

type QuoteLineStatusBadgeProps = {
  line: QuoteLine
  compact?: boolean
}

export function QuoteLineStatusBadge({ line, compact }: QuoteLineStatusBadgeProps) {
  if (compact) {
    return (
      <span
        className={cn(
          "inline-block h-2 w-2 shrink-0 rounded-full",
          line.pricingStatus === "unpriced" && "bg-amber-400",
          line.pricingStatus === "estimated" && "bg-slate-400",
          line.pricingStatus === "rfq_pending" && "bg-blue-400",
          line.pricingStatus === "costed" && "bg-emerald-500"
        )}
        title={PRICING_STATUS_LABELS[line.pricingStatus]}
      />
    )
  }

  return (
    <Badge variant={STATUS_VARIANT[line.pricingStatus]} className="font-normal">
      {PRICING_STATUS_LABELS[line.pricingStatus]}
    </Badge>
  )
}

export function QuoteLineSourceHint({ line }: { line: QuoteLine }) {
  if (line.costSource === "subcontractor" && line.costSourceSubcontractor) {
    return (
      <span className="text-sm text-emerald-800" title="Bekerülési forrás">
        {line.costSourceSubcontractor}
      </span>
    )
  }
  if (line.costSource === "catalog") {
    return <span className="text-sm text-slate-600">{COST_SOURCE_LABELS.catalog}</span>
  }
  if (line.costSource === "manual") {
    return <span className="text-sm text-slate-600">{COST_SOURCE_LABELS.manual}</span>
  }
  return null
}
