"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Quote, QuoteLine, RfqInvitation, SubcontractorRfq, SubcontractorRfqSubmission } from "@/types/projects"
import { applyRfqPackageDecision } from "@/lib/data/projects-store"
import { findCheapestPackageInvitation } from "@/lib/quote-rfq-context"
import {
  getInvitationSubmission,
  previewMarginAfterSelections,
} from "@/lib/rfq-package-utils"
import { formatHuf } from "@/lib/pricing"
import { getTradeLabel } from "@/lib/trades"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RfqLineComparisonTable } from "@/components/projektek/rfq-line-comparison-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

export type QuoteRfqDecisionIntent = "decide" | "change"

type QuoteRfqDecisionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  intent?: QuoteRfqDecisionIntent
  pkg: SubcontractorRfq
  quote: Quote
  quoteLines: QuoteLine[]
  invitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
  winningInvitationId?: string | null
  onApplied: () => void
}

export function QuoteRfqDecisionDialog({
  open,
  onOpenChange,
  intent = "decide",
  pkg,
  quote,
  quoteLines,
  invitations,
  submissions,
  winningInvitationId = null,
  onApplied,
}: QuoteRfqDecisionDialogProps) {
  const [packageWinner, setPackageWinner] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [compact, setCompact] = useState(true)
  const isChange = intent === "change"

  const submittedInvitations = useMemo(
    () =>
      invitations.filter((inv) => submissions.some((s) => s.invitationId === inv.id)),
    [invitations, submissions]
  )

  const currentWinner = useMemo(
    () => invitations.find((i) => i.id === winningInvitationId) ?? null,
    [invitations, winningInvitationId]
  )

  useEffect(() => {
    if (!open) return
    if (isChange && winningInvitationId) {
      setPackageWinner(winningInvitationId)
      return
    }
    const cheap = findCheapestPackageInvitation(pkg, invitations, submissions)
    setPackageWinner(cheap ?? submittedInvitations[0]?.id ?? "")
  }, [open, isChange, winningInvitationId, pkg, invitations, submissions, submittedInvitations])

  const marginPreview = useMemo(() => {
    if (!packageWinner) return null
    const sub = getInvitationSubmission(packageWinner, submissions)
    if (!sub) return null
    const sel = new Map<string, { invitationId: string; submission: SubcontractorRfqSubmission }>()
    for (const rfl of pkg.lines) {
      if (rfl.quoteLineId) {
        sel.set(rfl.quoteLineId, { invitationId: packageWinner, submission: sub })
      }
    }
    return previewMarginAfterSelections(quote, quoteLines, pkg, sel)
  }, [packageWinner, quote, quoteLines, pkg, submissions])

  const sameAsCurrent = isChange && packageWinner === winningInvitationId

  const selectedInvitation = submittedInvitations.find((i) => i.id === packageWinner)

  const handleConfirmClick = () => {
    if (!packageWinner) {
      toast.error("Válassz alvállalkozót")
      return
    }
    if (sameAsCurrent) {
      toast.info("Ez már a jelenlegi nyertes alvállalkozó")
      return
    }
    setConfirmOpen(true)
  }

  const executeDecision = () => {
    const { updated } = applyRfqPackageDecision(pkg.id, packageWinner)
    if (updated > 0) {
      toast.success(
        isChange
          ? `Nyertes módosítva — ${selectedInvitation?.subcontractorName} (${updated} tétel)`
          : `${updated} tétel bekerülésbe írva — ${selectedInvitation?.subcontractorName}`
      )
      onApplied()
      onOpenChange(false)
    } else {
      toast.error("Nem sikerült alkalmazni — ellenőrizd az ajánlatot")
    }
  }

  const canShowForm = submittedInvitations.length > 0 && (isChange || pkg.status !== "decided")

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(96vh,900px)] max-h-[96vh] w-[min(96vw,1200px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-base">
              {isChange ? "Döntés módosítása" : "Döntés"} — {pkg.title}
            </DialogTitle>
            {canShowForm ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setCompact((v) => !v)}
              >
                {compact ? "Részletes oszlopok" : "Kompakt nézet"}
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {!isChange && pkg.status === "decided" ? (
          <p className="p-4 text-sm text-slate-600">Erre a bekérésre már született döntés.</p>
        ) : submittedInvitations.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">Még nincs beküldött ajánlat.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {isChange && currentWinner ? (
              <p className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950">
                Jelenlegi nyertes: <strong>{currentWinner.subcontractorName}</strong>
              </p>
            ) : null}

            <div className="min-h-0 flex-1 overflow-hidden p-3">
              <RfqLineComparisonTable
                pkg={pkg}
                quoteLines={quoteLines}
                invitations={invitations}
                submissions={submissions}
                compact={compact}
                maxHeight="100%"
                className="h-full"
                footerLabel="Döntés előtti összesítő"
              />
            </div>

            <div className="shrink-0 space-y-3 border-t bg-slate-50 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">
                    {isChange ? "Új nyertes alvállalkozó (teljes csomag)" : "Győztes alvállalkozó (teljes csomag)"}
                  </Label>
                  <Select value={packageWinner} onValueChange={setPackageWinner}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Válassz…" />
                    </SelectTrigger>
                    <SelectContent>
                      {submittedInvitations.map((inv) => {
                        const sub = getInvitationSubmission(inv.id, submissions)
                        const isCurrent = inv.id === winningInvitationId
                        return (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.subcontractorName}
                            {sub ? ` — ${formatHuf(sub.totalAmount)}` : ""}
                            {isCurrent ? " (jelenlegi)" : ""}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-600">
                    Szakág: {getTradeLabel(pkg.trade)} · Egy alvállalkozó nyeri a teljes csomagot.
                  </p>
                </div>

                {marginPreview ? (
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm",
                      marginPreview.marginPercent != null && marginPreview.marginPercent < 12
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <p className="text-xs font-medium text-slate-700">
                      {isChange ? "Előnézet a módosítás után" : "Előnézet a döntés után"}
                    </p>
                    <p className="mt-1 tabular-nums">
                      Bekerülés: {formatHuf(marginPreview.costTotal)} · Ügyfél:{" "}
                      {formatHuf(marginPreview.sellTotal)} · Fedezet:{" "}
                      {marginPreview.marginPercent != null ? `${marginPreview.marginPercent}%` : "—"}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          {canShowForm ? (
            <Button onClick={handleConfirmClick} disabled={sameAsCurrent}>
              {isChange ? "Nyertes módosítása" : "Elfogadás és bekerülésbe írás"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={isChange ? "Döntés módosítása" : "Ajánlat elfogadása"}
      description={
        isChange ? (
          <>
            <p>
              <strong>{currentWinner?.subcontractorName ?? "—"}</strong>
              {" → "}
              <strong>{selectedInvitation?.subcontractorName ?? "—"}</strong>
            </p>
            <p>A bekerülési árak frissülnek, a korábbi nyertes elutasításra kerül.</p>
          </>
        ) : (
          <>
            <p>
              Teljes csomag elfogadása:{" "}
              <strong>{selectedInvitation?.subcontractorName ?? "—"}</strong>
            </p>
            <p>A többi ajánlat elutasításra kerül, az árak bekerülésbe íródnak.</p>
          </>
        )
      }
      confirmLabel={isChange ? "Igen, módosítom" : "Igen, elfogadom"}
      onConfirm={executeDecision}
    />
    </>
  )
}
