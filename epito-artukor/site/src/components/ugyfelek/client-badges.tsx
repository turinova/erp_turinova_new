import type { Client } from "@/types/clients"
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from "@/lib/client-labels"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusVariant: Record<
  Client["status"],
  "default" | "secondary" | "success" | "warning" | "outline"
> = {
  active: "success",
  inactive: "secondary",
  prospect: "warning",
}

export function ClientTypeBadge({
  type,
  className,
}: {
  type: Client["clientType"]
  className?: string
}) {
  return (
    <Badge
      variant={type === "individual" ? "secondary" : "outline"}
      className={cn("text-sm font-normal", className)}
    >
      {CLIENT_TYPE_LABELS[type]}
    </Badge>
  )
}

export function ClientStatusBadge({
  status,
  className,
}: {
  status: Client["status"]
  className?: string
}) {
  return (
    <Badge variant={statusVariant[status]} className={cn("text-sm font-normal", className)}>
      {CLIENT_STATUS_LABELS[status]}
    </Badge>
  )
}
