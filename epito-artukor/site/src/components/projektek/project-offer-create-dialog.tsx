"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import { formatHuf } from "@/lib/pricing"
import { buildPackagePreviewFromQuoteIds } from "@/lib/customer-package"
import { getTradeLabel } from "@/lib/trades"
import type { QuoteWithSummary } from "@/lib/project-quote-aggregation"
import type { CustomerPackageType } from "@/types/projects"
import {
  createCustomerPackageDraft,
  listContractedQuoteIds,
  listQuoteIdsInDraftPackages,
  listQuoteIdsInSentPackages,
} from "@/lib/data/projects-store"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ProjectOfferCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  selectable: QuoteWithSummary[]
  draftLockedIds: Set<string>
  onCreated: () => void
}

export function ProjectOfferCreateDialog({
  open,
  onOpenChange,
  projectId,
  selectable,
  draftLockedIds,
  onCreated,
}: ProjectOfferCreateDialogProps) {
  const [title, setTitle] = useState("")
  const [packageType, setPackageType] = useState<CustomerPackageType>("full")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTitle("")
      setPackageType("full")
      setSelectedIds([])
      setSubmitting(false)
    }
  }, [open])

  const sentLockedIds = useMemo(() => new Set(listQuoteIdsInSentPackages(projectId)), [projectId])
  const contractedIds = useMemo(() => new Set(listContractedQuoteIds(projectId)), [projectId])

  const preview = useMemo(
    () => buildPackagePreviewFromQuoteIds(projectId, selectedIds, selectable),
    [projectId, selectedIds, selectable]
  )

  const quotesByTrade = useMemo(() => {
    const map = new Map<string, QuoteWithSummary[]>()
    for (const row of selectable) {
      const key = row.primaryTrade ?? "egyéb"
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) =>
      getTradeLabel(a[0] as Parameters<typeof getTradeLabel>[0]).localeCompare(
        getTradeLabel(b[0] as Parameters<typeof getTradeLabel>[0]),
        "hu"
      )
    )
  }, [selectable])

  const toggleQuote = (quoteId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, quoteId])] : prev.filter((id) => id !== quoteId)
    )
  }

  const handleCreate = () => {
    setSubmitting(true)
    try {
      createCustomerPackageDraft({
        projectId,
        title: title.trim() || `Árajánlat — ${new Date().toLocaleDateString("hu-HU")}`,
        quoteIds: selectedIds,
        type: packageType,
      })
      toast.success("Árajánlat piszkozat létrehozva")
      onCreated()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült létrehozni")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 pr-10">
          <DialogTitle className="text-base">Új árajánlat</DialogTitle>
          <DialogDescription className="text-xs">
            Válaszd ki a költségvetéseket — ugyanarra a szakágra is több lehet.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div>
            <Label htmlFor="offer-title" className="text-xs">
              Név
            </Label>
            <Input
              id="offer-title"
              className="mt-1 h-8 text-sm"
              placeholder="pl. Hyundai teljes — 2026. március"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Típus</Label>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {(
                [
                  ["full", "Teljes ajánlat — alap szerződés"],
                  ["supplement", "Kiegészítő — pótmunka, bővítés"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-xs text-slate-800">
                  <input
                    type="radio"
                    name="package-type"
                    checked={packageType === value}
                    onChange={() => setPackageType(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {selectable.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs text-slate-600">
              Még nincs költségvetés. Előbb a Költségvetés fülön hozz létre szakágokat.
            </p>
          ) : (
            <div className="space-y-2.5">
              {quotesByTrade.map(([trade, rows]) => (
                <div key={trade}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {trade === "egyéb"
                      ? "Egyéb"
                      : getTradeLabel(trade as Parameters<typeof getTradeLabel>[0])}
                  </p>
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200/90">
                    {rows.map((row) => {
                      const checked = selectedIds.includes(row.quote.id)
                      const inOtherDraft = draftLockedIds.has(row.quote.id)
                      const inSent = sentLockedIds.has(row.quote.id)
                      const contracted = contractedIds.has(row.quote.id)
                      const blockedBySupplement = packageType === "supplement" && contracted
                      const canSelect =
                        row.summary.readiness.canSend &&
                        !inOtherDraft &&
                        !inSent &&
                        !blockedBySupplement
                      const gross =
                        row.summary.lineCount > 0 && row.summary.sellTotal > 0
                          ? Math.round(row.summary.sellTotal * 1.27)
                          : 0

                      return (
                        <li
                          key={row.quote.id}
                          className={cn(
                            "flex items-center gap-2 bg-white px-2 py-1.5",
                            checked && "bg-blue-50/50"
                          )}
                        >
                          <Checkbox
                            className="h-3.5 w-3.5"
                            checked={checked}
                            disabled={!canSelect && !checked}
                            onCheckedChange={(v) => toggleQuote(row.quote.id, v === true)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-900">
                              {row.quote.title}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {QUOTE_STATUS_LABELS[row.quote.status]}
                              {row.summary.lineCount > 0
                                ? ` · ${row.summary.lineCount} tétel`
                                : " · üres"}
                              {!canSelect && !inOtherDraft && !inSent && !blockedBySupplement
                                ? " · hiányos"
                                : null}
                              {inOtherDraft ? " · másik piszkozatban" : null}
                              {inSent ? " · már elküldött ajánlatban" : null}
                              {blockedBySupplement ? " · már szerződésben" : null}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-slate-700">
                            {gross > 0 ? formatHuf(gross) : "—"}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {preview.blockers.length > 0 && selectedIds.length > 0 ? (
            <ul className="rounded-md border border-amber-200/90 bg-amber-50/60 px-2.5 py-2 text-xs text-amber-950">
              {preview.blockers.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:justify-between">
          <div className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Összesen
            </p>
            <p className="text-sm font-bold tabular-nums text-slate-950">
              {preview.canSend ? formatHuf(preview.grossTotal) : "—"}
            </p>
            <p className="truncate text-[10px] text-slate-600">
              {selectedIds.length} költségvetés
              {preview.mixedVat
                ? " · vegyes ÁFA"
                : preview.vatChipLabel
                  ? ` · ${preview.vatChipLabel}`
                  : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Mégse
            </Button>
            <Button
              size="sm"
              disabled={!preview.canSend || submitting || selectedIds.length === 0}
              onClick={handleCreate}
            >
              {submitting ? "Létrehozás…" : "Létrehozás"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
