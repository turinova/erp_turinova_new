"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { CustomerPackage } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import {
  CUSTOMER_PACKAGE_STATUS_LABELS,
  CUSTOMER_PACKAGE_TYPE_LABELS,
} from "@/lib/customer-package"
import { getTradeLabel } from "@/lib/trades"
import {
  deleteCustomerPackageDraft,
  listCustomerPackagesForProject,
  listOfferSelectableQuotes,
  listQuoteIdsInDraftPackages,
} from "@/lib/data/projects-store"
import { Button } from "@/components/ui/button"
import { ProjectOfferCreateDialog } from "@/components/projektek/project-offer-create-dialog"
import { ProjectOfferDetailDialog } from "@/components/projektek/project-offer-detail-dialog"
import { cn } from "@/lib/utils"

type ProjectOfferTabProps = {
  projectId: string
  tick: number
  onRefresh: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function formatSnapshotSummary(pkg: CustomerPackage): string {
  const byTrade = new Map<string, number>()
  for (const snap of pkg.snapshots) {
    const label = getTradeLabel(snap.trade)
    byTrade.set(label, (byTrade.get(label) ?? 0) + 1)
  }
  return [...byTrade.entries()]
    .map(([label, count]) => (count > 1 ? `${label} ×${count}` : label))
    .join(", ")
}

function statusClass(status: CustomerPackage["status"]): string {
  switch (status) {
    case "draft":
      return "bg-slate-200 text-slate-800"
    case "sent":
      return "bg-blue-100 text-blue-950"
    case "accepted":
      return "bg-emerald-100 text-emerald-950"
    case "rejected":
      return "bg-red-100 text-red-900"
    case "superseded":
      return "bg-slate-100 text-slate-600"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

export function ProjectOfferTab({ projectId, tick, onRefresh }: ProjectOfferTabProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const selectable = useMemo(() => {
    void tick
    return listOfferSelectableQuotes(projectId)
  }, [projectId, tick])

  const packages = useMemo(() => {
    void tick
    return listCustomerPackagesForProject(projectId)
  }, [projectId, tick])

  const draftLockedIds = useMemo(() => {
    void tick
    return new Set(listQuoteIdsInDraftPackages(projectId))
  }, [projectId, tick])

  const openDetail = (pkg: CustomerPackage) => {
    setDetailId(pkg.id)
    setDetailOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, pkg: CustomerPackage) => {
    e.stopPropagation()
    if (pkg.status !== "draft") return
    if (!confirm(`„${pkg.title}” piszkozat törlése?`)) return
    if (!deleteCustomerPackageDraft(pkg.id)) {
      toast.error("Csak piszkozat törölhető")
      return
    }
    toast.success("Piszkozat törölve")
    onRefresh()
  }

  return (
    <>
      <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Árajánlatok</h2>
            <p className="text-xs text-slate-500">
              {packages.length === 0 ? "Még nincs árajánlat" : `${packages.length} db`}
            </p>
          </div>
          <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Új árajánlat
          </Button>
        </div>

        {packages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-slate-600">Még nincs létrehozott árajánlat.</p>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              Első árajánlat összeállítása
            </Button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Név</th>
                  <th className="hidden px-2 py-2 font-semibold md:table-cell">Típus</th>
                  <th className="hidden px-2 py-2 font-semibold sm:table-cell">Dátum</th>
                  <th className="px-2 py-2 font-semibold">Státusz</th>
                  <th className="px-2 py-2 text-right font-semibold">Bruttó</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="group cursor-pointer hover:bg-slate-50/80"
                    onClick={() => openDetail(pkg)}
                  >
                    <td className="max-w-[12rem] px-4 py-2 sm:max-w-none">
                      <p className="truncate text-sm font-medium text-slate-900">{pkg.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {pkg.snapshots.length} költségvetés · {formatSnapshotSummary(pkg)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400 sm:hidden">
                        {formatDate(pkg.sentAt)}
                      </p>
                    </td>
                    <td className="hidden px-2 py-2 md:table-cell">
                      <span className="text-[10px] font-medium text-slate-600">
                        {CUSTOMER_PACKAGE_TYPE_LABELS[pkg.type]}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-2 py-2 text-xs text-slate-600 sm:table-cell">
                      {formatDate(pkg.sentAt)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          statusClass(pkg.status)
                        )}
                      >
                        {CUSTOMER_PACKAGE_STATUS_LABELS[pkg.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                      {formatHuf(
                        pkg.status === "accepted"
                          ? (pkg.acceptedGrossTotal ?? pkg.grossTotal)
                          : pkg.grossTotal
                      )}
                    </td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {pkg.status === "draft" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-700"
                          onClick={(e) => handleDelete(e, pkg)}
                          aria-label="Piszkozat törlése"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjectOfferCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        selectable={selectable}
        draftLockedIds={draftLockedIds}
        onCreated={onRefresh}
      />

      <ProjectOfferDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        packageId={detailId}
        projectId={projectId}
        tick={tick}
        onRefresh={onRefresh}
      />
    </>
  )
}
