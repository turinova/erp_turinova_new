"use client"

import { Printer } from "lucide-react"
import type { PerformanceCertificate } from "@/types/projects"
import { performanceCertificateToPreview } from "@/lib/tig-document"
import { formatTigDate } from "@/lib/tig-preview-build"
import { formatHuf } from "@/lib/pricing"
import { TigPreviewDocument } from "@/components/projektek/tig-preview-document"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

type TigPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  certificate: PerformanceCertificate | null
}

export function TigPreviewDialog({ open, onOpenChange, certificate }: TigPreviewDialogProps) {
  const preview = certificate ? performanceCertificateToPreview(certificate) : null

  const handlePrint = () => {
    const el = document.querySelector(".tig-preview-dialog-content .tig-preview-document")
    if (!el) return
    const win = window.open("", "_blank", "noopener,noreferrer")
    if (!win) {
      toast.error("A nyomtatási ablak nem nyitható meg")
      return
    }
    win.document.write(`<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8" />
<title>${certificate?.documentNumber ?? "TIG"}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#0f172a}</style>
</head><body>${el.outerHTML}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="text-left">
            {certificate ? certificate.documentNumber : "Teljesítésigazolás"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {certificate
              ? `Kelte: ${formatTigDate(certificate.issuedAt)} · ${certificate.lines.length} tétel · ${formatHuf(certificate.grossTotal)} bruttó`
              : "Az igazolás nem található."}
          </DialogDescription>
        </DialogHeader>

        <div className="tig-preview-dialog-content min-h-0 flex-1 overflow-y-auto bg-zinc-100 p-4 sm:p-6">
          {preview ? (
            <TigPreviewDocument model={preview} />
          ) : (
            <p className="text-sm text-slate-600">Az előnézet nem állítható össze.</p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bezárás
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={!preview}
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
