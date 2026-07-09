import type { Subcontractor } from "@/types/subcontractors"
import {
  SUBCONTRACTOR_STATUS_LABELS,
  SUBCONTRACTOR_TIER_LABELS,
} from "@/lib/subcontractor-labels"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const tierVariant: Record<
  Subcontractor["tier"],
  "default" | "secondary" | "success" | "warning" | "outline"
> = {
  preferred: "success",
  standard: "secondary",
  reserve: "outline",
  new: "warning",
}

const statusVariant: Record<
  Subcontractor["status"],
  "default" | "secondary" | "success" | "warning" | "outline"
> = {
  active: "success",
  inactive: "secondary",
  blocked: "warning",
  prospect: "outline",
}

export function SubcontractorTierBadge({
  tier,
  className,
}: {
  tier: Subcontractor["tier"]
  className?: string
}) {
  return (
    <Badge variant={tierVariant[tier]} className={cn("text-sm font-normal", className)}>
      {SUBCONTRACTOR_TIER_LABELS[tier]}
    </Badge>
  )
}

export function SubcontractorStatusBadge({
  status,
  className,
}: {
  status: Subcontractor["status"]
  className?: string
}) {
  return (
    <Badge variant={statusVariant[status]} className={cn("text-sm font-normal", className)}>
      {SUBCONTRACTOR_STATUS_LABELS[status]}
    </Badge>
  )
}
