"use client"

import { useEffect, useMemo, useState } from "react"
import { FileCheck2, Printer } from "lucide-react"
import { toast } from "sonner"
import type { Quote } from "@/types/projects"
import { buildTigPreview } from "@/lib/tig-document"
import { isLineEligibleForTig } from "@/lib/quote-execution"
import { createPerformanceCertificate } from "@/lib/data/projects-store"
import { formatHuf } from "@/lib/pricing"
import { TigPreviewDocument } from "@/components/projektek/tig-preview-document"
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

type TigCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  quote: Quote
  lines: import("@/types/projects").QuoteLine[]
  onSaved: () => void
}

export function TigCreateDialog({
  open,
  onOpenChange,
  projectId,
  quote,
  lines,
  onSaved,
}: TigCreateDialogProps) {
  const eligibleLines = useMemo(
    () => [...lines].filter(isLineEligibleForTig).sort((a, b) => a.sortOrder - b.sortOrder),
    [lines]
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodFrom, setPeriodFrom] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedIds(eligibleLines.map((l) => l.id))
    setPeriodTo(new Date().toISOString().slice(0, 10))
    setPeriodFrom("")
    setNotes("")
  }, [open, eligibleLines])

  const preview = useMemo(() => {
    if (selectedIds.length === 0) return null
    return buildTigPreview({
      projectId,
      quoteId: quote.id,
      lineIds: selectedIds,
      periodTo,
      periodFrom: periodFrom || undefined,
      notes: notes.trim() || undefined,
    })
  }, [projectId, quote.id, selectedIds, periodTo, periodFrom, notes])

  const toggleLine = (lineId: string) => {
    setSelectedIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    )
  }

  const handlePrint = () => {
    const el = document.querySelector(".tig-preview-document")
    if (!el) return
    const win = window.open("", "_blank", "noopener,noreferrer")
    if (!win) {
      toast.error("A nyomtatási ablak nem nyitható meg")
      return
    }
    win.document.write(`<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8" />
<title>TIG előnézet</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 6px 8px; }
</style></head><body>${el.outerHTML}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  const handleSave = () => {
    if (selectedIds.length === 0) {
      toast.error("Válassz legalább egy kész tételt")
      return
    }
    setSaving(true)
    const cert = createPerformanceCertificate({
      projectId,
      quoteId: quote.id,
      lineIds: selectedIds,
      periodTo,
      periodFrom: periodFrom || undefined,
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (!cert) {
      toast.error("A TIG rögzítése nem sikerült")
      return
    }
    toast.success(`TIG rögzítve: ${cert.documentNumber}`)
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-left">
            <FileCheck2 className="h-5 w-5 text-emerald-600" />
            Teljesítésigazolás (TIG)
          </DialogTitle>
          <DialogDescription className="text-left">
            Válaszd ki a kész tételeket, ellenőrizd az előnézetet, majd rögzítsd. PDF nem készül —
            nyomtatáshoz használd az előnézet funkciót.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(16rem,22rem)_1fr]">
          <aside className="shrink-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Kész tételek ({eligibleLines.length})
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Csak a még nem igazolt, késznek jelölt sorok választhatók.
                </p>
              </div>

              {eligibleLines.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
                  Nincs igazolható tétel. Előbb pipáld ki a kész munkákat a kivitelezés listában.
                </p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 lg:max-h-72">
                  {eligibleLines.map((line) => {
                    const checked = selectedIds.includes(line.id)
                    return (
                      <li key={line.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-slate-50",
                            checked && "bg-emerald-50/60"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleLine(line.id)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 text-xs leading-snug">
                            <span className="font-code text-blue-700">{line.identifierSnapshot}</span>
                            <span className="mt-0.5 block text-slate-800">{line.textSnapshot}</span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tig-period-to" className="text-xs">
                    Teljesítés vége
                  </Label>
                  <Input
                    id="tig-period-to"
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tig-period-from" className="text-xs">
                    Teljesítés kezdete (opcionális)
                  </Label>
                  <Input
                    id="tig-period-from"
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tig-notes" className="text-xs">
                    Megjegyzés (opcionális)
                  </Label>
                  <Input
                    id="tig-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Pl. 2. ütem"
                    className="h-9"
                  />
                </div>
              </div>

              {preview ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  <p className="font-semibold">Összesítés</p>
                  <p className="mt-1 tabular-nums">
                    {selectedIds.length} tétel · nettó {formatHuf(preview.sellNetTotal)} · bruttó{" "}
                    {formatHuf(preview.grossTotal)}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="tig-preview-scroll min-h-0 overflow-y-auto bg-zinc-100 p-4 sm:p-6">
            {preview ? (
              <TigPreviewDocument model={preview} />
            ) : (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                Válassz legalább egy tételt az előnézethez.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            disabled={!preview}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Nyomtatás
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!preview || saving || eligibleLines.length === 0}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            <FileCheck2 className="h-4 w-4" />
            TIG rögzítése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
