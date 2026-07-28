"use client"

import { Copy, ExternalLink, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { RfqInvitation } from "@/types/projects"
import { RFQ_INVITATION_STATUS_LABELS } from "@/lib/project-labels"
import { deleteRfqInvitation } from "@/lib/data/projects-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function publicRfqUrl(accessToken: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rfq/${accessToken}`
  }
  return `/rfq/${accessToken}`
}

export function copyRfqInviteMessage(inv: RfqInvitation, tradeLabels?: string[]): void {
  const url = publicRfqUrl(inv.accessToken)
  const trades =
    tradeLabels && tradeLabels.length > 0 ? tradeLabels.join(", ") : null
  navigator.clipboard.writeText(
    [
      `Kedves ${inv.subcontractorName}!`,
      "",
      ...(trades ? [`Árajánlatkérés: ${trades}`] : []),
      `Link: ${url}`,
      `Belépő kód: ${inv.accessCode}`,
      "",
      "A linken megnyitva írd be a kódot.",
    ].join("\n")
  )
  toast.success("Üzenet másolva (link + kód)")
}

type RfqPartnerAccessListProps = {
  invitations: RfqInvitation[]
  /** Nyertes invitation id — kiemeléshez */
  winningInvitationId?: string | null
  title?: string
  compact?: boolean
  className?: string
  /** Törlés után frissítés */
  onChanged?: () => void
  /** Ha false, nincs törlés gomb */
  allowDelete?: boolean
}

/**
 * Minden meghívott alvállalkozó belépője (nyertes és nem nyertes egyaránt).
 * A /rfq/{token} + PIN az ő „dashboardjuk” — döntés után is elérhető kell legyen.
 */
export function RfqPartnerAccessList({
  invitations,
  winningInvitationId = null,
  title = "Alvállalkozói belépők",
  compact = false,
  className,
  onChanged,
  allowDelete = true,
}: RfqPartnerAccessListProps) {
  if (invitations.length === 0) return null

  const sorted = [...invitations].sort((a, b) => {
    if (a.id === winningInvitationId) return -1
    if (b.id === winningInvitationId) return 1
    if (a.status === "accepted") return -1
    if (b.status === "accepted") return 1
    return a.subcontractorName.localeCompare(b.subcontractorName, "hu")
  })

  const handleDelete = (inv: RfqInvitation) => {
    if (inv.status === "accepted") {
      toast.error("A nyertes meghívás nem törölhető")
      return
    }
    const ok = window.confirm(
      `Törlöd ${inv.subcontractorName} meghívását?\nA link érvényét veszti.`
    )
    if (!ok) return
    const result = deleteRfqInvitation(inv.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Meghívás törölve")
    onChanged?.()
  }

  return (
    <div className={cn("border border-slate-200 bg-slate-50/80", className)}>
      {!compact ? (
        <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800">
          {title}
          <span className="ml-1 font-normal text-slate-500">
            ({invitations.length}) — link + kód
          </span>
        </p>
      ) : null}
      <ul className={cn(compact ? "divide-y divide-slate-100" : "divide-y divide-slate-200")}>
        {sorted.map((inv) => {
          const isWinner = inv.id === winningInvitationId || inv.status === "accepted"
          const url = publicRfqUrl(inv.accessToken)
          const canDelete =
            allowDelete && inv.status !== "accepted" && Boolean(onChanged)
          const statusLabel = RFQ_INVITATION_STATUS_LABELS[inv.status] ?? inv.status
          return (
            <li
              key={inv.id}
              className={cn(
                "flex items-center gap-1.5",
                compact ? "px-2.5 py-1" : "flex-wrap gap-2 px-3 py-2",
                isWinner && "bg-emerald-50/70"
              )}
            >
              <div className="min-w-0 flex-1">
                {compact ? (
                  <p className="truncate text-xs text-slate-900">
                    <span className="font-medium">{inv.subcontractorName}</span>
                    {isWinner ? (
                      <span className="ml-1 font-semibold text-emerald-800">nyertes</span>
                    ) : null}
                    <span className="text-slate-400"> · </span>
                    <span className="text-slate-600">{statusLabel}</span>
                    <span className="text-slate-400"> · </span>
                    <span className="font-mono font-semibold tracking-wider text-slate-900">
                      {inv.accessCode}
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-slate-950">
                      {inv.subcontractorName}
                      {isWinner ? (
                        <span className="ml-1.5 text-[11px] font-semibold text-emerald-800">
                          nyertes
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {statusLabel}
                      <span className="mx-1 text-slate-300">·</span>
                      PIN{" "}
                      <span className="font-mono font-semibold tracking-wider text-slate-900">
                        {inv.accessCode}
                      </span>
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={compact ? "ghost" : "outline"}
                  className={cn(
                    "gap-1",
                    compact ? "h-6 w-6 px-0" : "h-8 text-xs"
                  )}
                  onClick={() => copyRfqInviteMessage(inv)}
                  title="Üzenet másolása"
                >
                  <Copy className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                  {compact ? null : "Másolás"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn("gap-1", compact ? "h-6 w-6 px-0" : "h-8 text-xs")}
                  asChild
                >
                  <a href={url} target="_blank" rel="noreferrer" title="Megnyitás">
                    <ExternalLink className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                    {compact ? null : "Megnyitás"}
                  </a>
                </Button>
                {canDelete ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "gap-1 text-red-700 hover:bg-red-50 hover:text-red-800",
                      compact ? "h-6 w-6 px-0" : "h-8 text-xs"
                    )}
                    onClick={() => handleDelete(inv)}
                    title="Meghívás törlése"
                  >
                    <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                    {compact ? null : "Törlés"}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
