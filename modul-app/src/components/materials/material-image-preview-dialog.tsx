'use client'

import { RotateCcw, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  removeSheetMaterialImageByUrl,
  rotateImageUrlToFile,
  uploadSheetMaterialImage,
  type RotateDegrees
} from '@/lib/sheet-materials/image-upload'

type MaterialImagePreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | null
  imageUrl: string | null
  tenantId: string | null
  canWrite: boolean
  showGrainHint?: boolean
  onImageSaved: (nextUrl: string) => void
  persistImageUrl: (
    nextUrl: string
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  onOpenMaterial?: () => void
}

export function MaterialImagePreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  imageUrl,
  tenantId,
  canWrite,
  showGrainHint = false,
  onImageSaved,
  persistImageUrl,
  onOpenMaterial
}: MaterialImagePreviewDialogProps) {
  const [busy, setBusy] = useState(false)

  async function handleRotate(degrees: RotateDegrees) {
    if (!imageUrl || !tenantId || !canWrite || busy) return
    setBusy(true)
    try {
      const rotated = await rotateImageUrlToFile(imageUrl, degrees)
      if (!rotated.ok) {
        toast.error(rotated.message)
        return
      }
      const uploaded = await uploadSheetMaterialImage(tenantId, rotated.file)
      if (!uploaded.ok) {
        toast.error(uploaded.message)
        return
      }
      const saved = await persistImageUrl(uploaded.publicUrl)
      if (!saved.ok) {
        toast.error(saved.message)
        void removeSheetMaterialImageByUrl(uploaded.publicUrl)
        return
      }
      void removeSheetMaterialImageByUrl(imageUrl)
      onImageSaved(uploaded.publicUrl)
      toast.success('Kép elforgatva.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {imageUrl ? (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-md border border-border bg-app">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                className="mx-auto max-h-[60vh] w-full object-contain"
              />
              {showGrainHint ? (
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col justify-evenly px-4 py-3"
                  aria-hidden
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className="h-0.5 w-full shrink-0 rounded-sm bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                    />
                  ))}
                </div>
              ) : null}
            </div>
            {showGrainHint && canWrite ? (
              <p className="text-hint text-ink-secondary">
                A vonalak a szálirányt jelzik — forgatással igazítsd a textúrát.
              </p>
            ) : null}
          </div>
        ) : null}

        {canWrite && imageUrl && tenantId ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              loading={busy}
              onClick={() => void handleRotate(-90)}
              aria-label="Forgatás balra 90 fok"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              90° balra
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              loading={busy}
              onClick={() => void handleRotate(90)}
              aria-label="Forgatás jobbra 90 fok"
            >
              <RotateCw className="size-3.5" aria-hidden />
              90° jobbra
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Bezárás
          </Button>
          {onOpenMaterial ? (
            <Button
              type="button"
              disabled={busy}
              onClick={onOpenMaterial}
            >
              Anyag megnyitása
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
