"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import type { CustomerPackage } from "@/types/projects"
import {
  CUSTOMER_PACKAGE_STATUS_LABELS,
  CUSTOMER_PACKAGE_TYPE_LABELS,
  isCustomerPackageExpired,
} from "@/lib/customer-package"
import { getTradeLabel } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"
import {
  deleteCustomerPackageDraft,
  getCustomerPackage,
  publishCustomerPackageDraft,
  updateProject,
} from "@/lib/data/projects-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProjectOfferLinkBlock } from "@/components/projektek/project-offer-link-block"
import { ProjectOfferResponseDialog } from "@/components/projektek/project-offer-response-dialog"
import { cn } from "@/lib/utils"

type ProjectOfferDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageId: string | null
  projectId: string
  tick: number
  onRefresh: () => void
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ProjectOfferDetailDialog({
  open,
  onOpenChange,
  packageId,
  projectId,
  tick,
  onRefresh,
}: ProjectOfferDetailDialogProps) {
  const [publishing, setPublishing] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)

  const pkg = useMemo(() => {
    void tick
    return packageId ? getCustomerPackage(packageId) : undefined
  }, [packageId, tick])

  const expired = pkg ? isCustomerPackageExpired(pkg) : false

  const handlePublish = () => {
    if (!pkg) return
    if (!confirm(`„${pkg.title}” elküldése ügyfélnek?\n${formatHuf(pkg.grossTotal)} bruttó`)) return
    setPublishing(true)
    try {
      publishCustomerPackageDraft(pkg.id)
      toast.success("Árajánlat elküldve — link és kód kész")
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült elküldeni")
    } finally {
      setPublishing(false)
    }
  }

  const handleDelete = () => {
    if (!pkg || pkg.status !== "draft") return
    if (!confirm(`„${pkg.title}” piszkozat törlése?`)) return
    if (!deleteCustomerPackageDraft(pkg.id)) {
      toast.error("Csak piszkozat törölhető")
      return
    }
    toast.success("Piszkozat törölve")
    onRefresh()
    onOpenChange(false)
  }

  const handleStartExecution = () => {
    updateProject(projectId, { status: "in_progress" })
    toast.success("Kivitelezés elindítva")
    onRefresh()
  }

  if (!pkg) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <p className="text-sm text-slate-600">Az árajánlat nem található.</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base">{pkg.title}</DialogTitle>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  pkg.status === "draft" && "bg-slate-200 text-slate-800",
                  pkg.status === "sent" && "bg-blue-100 text-blue-950",
                  pkg.status === "accepted" && "bg-emerald-100 text-emerald-950",
                  pkg.status === "rejected" && "bg-red-100 text-red-900",
                  pkg.status === "superseded" && "bg-slate-100 text-slate-600"
                )}
              >
                {CUSTOMER_PACKAGE_STATUS_LABELS[pkg.status]}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                {CUSTOMER_PACKAGE_TYPE_LABELS[pkg.type]}
              </span>
            </div>
            <DialogDescription className="text-xs">
              {formatDateTime(pkg.sentAt)} ·{" "}
              {pkg.status === "accepted"
                ? `${formatHuf(pkg.acceptedGrossTotal ?? pkg.grossTotal)} bruttó (elfogadott)`
                : `${formatHuf(pkg.grossTotal)} bruttó`}{" "}
              · {pkg.snapshots.length} költségvetés
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            {pkg.status === "superseded" ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Ezt az ajánlatot egy újabb váltotta fel. Az ügyfél linkje már nem aktív.
              </p>
            ) : null}

            {pkg.status === "sent" && expired ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Az ajánlat érvényessége lejárt. Küldj frissített ajánlatot.
              </p>
            ) : null}

            {pkg.status === "accepted" && pkg.respondedAt ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950">
                <strong>Elfogadva</strong>
                {pkg.respondedByName ? ` — ${pkg.respondedByName}` : null}
                {pkg.respondedAt ? ` · ${formatDateTime(pkg.respondedAt)}` : null}
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Költségvetések
              </p>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200/90">
                {(pkg.status === "accepted" && pkg.acceptedSnapshots
                  ? pkg.acceptedSnapshots
                  : pkg.snapshots
                ).map((snap) => (
                  <li
                    key={snap.quoteId}
                    className="flex items-center justify-between gap-2 bg-white px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900">
                        {getTradeLabel(snap.trade)}
                      </p>
                      <p className="truncate text-[11px] text-slate-600">{snap.quoteTitle}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-800">
                      {formatHuf(snap.grossTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {pkg.status === "sent" || pkg.status === "accepted" ? (
              <ProjectOfferLinkBlock pkg={pkg} />
            ) : null}

            {pkg.notes || pkg.clientNotes ? (
              <div className="text-xs text-slate-600">
                {pkg.clientNotes ? <p>Ügyfél: {pkg.clientNotes}</p> : null}
                {pkg.notes ? <p>Megjegyzés: {pkg.notes}</p> : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
            {pkg.status === "draft" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:text-red-800"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Törlés
                </Button>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Bezárás
                  </Button>
                  <Button size="sm" disabled={publishing} onClick={handlePublish}>
                    {publishing ? "Küldés…" : "Küldés ügyfélnek"}
                  </Button>
                </div>
              </>
            ) : null}

            {pkg.status === "sent" && !expired ? (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Bezárás
                </Button>
                <Button size="sm" onClick={() => setResponseOpen(true)}>
                  Válasz rögzítése
                </Button>
              </>
            ) : null}

            {pkg.status === "accepted" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Bezárás
                </Button>
                <Button size="sm" variant="secondary" onClick={handleStartExecution}>
                  Kivitelezés indítása
                </Button>
              </>
            ) : null}

            {(pkg.status === "rejected" ||
              pkg.status === "superseded" ||
              (pkg.status === "sent" && expired)) && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => onOpenChange(false)}>
                Bezárás
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectOfferResponseDialog
        open={responseOpen}
        onOpenChange={setResponseOpen}
        pkg={pkg.status === "sent" ? pkg : null}
        onRecorded={onRefresh}
      />
    </>
  )
}
