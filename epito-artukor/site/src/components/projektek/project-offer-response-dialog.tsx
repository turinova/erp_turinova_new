"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { CustomerPackage } from "@/types/projects"
import { getTradeLabel } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"
import type { CustomerPackageResponseType } from "@/lib/customer-package"
import { recordCustomerPackageResponse } from "@/lib/data/projects-store"
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
import { Textarea } from "@/components/ui/textarea"

type ProjectOfferResponseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pkg: CustomerPackage | null
  onRecorded: () => void
}

export function ProjectOfferResponseDialog({
  open,
  onOpenChange,
  pkg,
  onRecorded,
}: ProjectOfferResponseDialogProps) {
  const [responseType, setResponseType] = useState<CustomerPackageResponseType>("accept_all")
  const [acceptedIds, setAcceptedIds] = useState<string[]>([])
  const [respondedByName, setRespondedByName] = useState("")
  const [clientNotes, setClientNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !pkg) return
    setResponseType("accept_all")
    setAcceptedIds(pkg.snapshots.map((s) => s.quoteId))
    setRespondedByName("")
    setClientNotes("")
    setSubmitting(false)
  }, [open, pkg])

  if (!pkg) return null

  const handleSubmit = () => {
    if (responseType !== "reject_all" && !respondedByName.trim()) {
      toast.error("Add meg az ügyfél nevét")
      return
    }
    setSubmitting(true)
    try {
      recordCustomerPackageResponse(pkg.id, {
        type: responseType,
        acceptedQuoteIds: responseType === "partial" ? acceptedIds : undefined,
        respondedByName: respondedByName.trim() || undefined,
        clientNotes: clientNotes.trim() || undefined,
        viaLink: false,
      })
      toast.success(
        responseType === "reject_all" ? "Elutasítás rögzítve" : "Elfogadás rögzítve"
      )
      onRecorded()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült rögzíteni")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ügyfél válasz rögzítése</DialogTitle>
          <DialogDescription className="text-xs">
            Telefonon vagy személyesen érkezett válasz — link nélkül.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Válasz típusa</Label>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["accept_all", "Mindet elfogadja"],
                  ["partial", "Csak kiválasztott költségvetések"],
                  ["reject_all", "Elutasítja"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="response-type"
                    checked={responseType === value}
                    onChange={() => {
                      setResponseType(value)
                      if (value === "accept_all") {
                        setAcceptedIds(pkg.snapshots.map((s) => s.quoteId))
                      }
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {responseType === "partial" ? (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-slate-200 p-2">
              {pkg.snapshots.map((snap) => (
                <label
                  key={snap.quoteId}
                  className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={acceptedIds.includes(snap.quoteId)}
                    onCheckedChange={(v) => {
                      setAcceptedIds((prev) =>
                        v === true
                          ? [...new Set([...prev, snap.quoteId])]
                          : prev.filter((id) => id !== snap.quoteId)
                      )
                    }}
                  />
                  <span>
                    <span className="font-medium">{getTradeLabel(snap.trade)}</span>
                    <span className="text-slate-600"> — {snap.quoteTitle}</span>
                    <span className="ml-1 tabular-nums text-slate-700">
                      ({formatHuf(snap.grossTotal)})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {responseType !== "reject_all" ? (
            <div>
              <Label htmlFor="responded-by">Ügyfél neve</Label>
              <Input
                id="responded-by"
                className="mt-1"
                placeholder="pl. Kiss András"
                value={respondedByName}
                onChange={(e) => setRespondedByName(e.target.value)}
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="client-notes">Megjegyzés (opcionális)</Label>
            <Textarea
              id="client-notes"
              className="mt-1 min-h-[4rem]"
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button
            disabled={
              submitting ||
              (responseType === "partial" && acceptedIds.length === 0)
            }
            onClick={handleSubmit}
          >
            {submitting ? "Rögzítés…" : "Rögzítés"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
