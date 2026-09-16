'use client'

import { FolderOpen, ImagePlus, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { MediaPickerDialog } from '@/components/media/media-picker-dialog'
import { Button } from '@/components/ui/button'
import {
  removeSheetMaterialImageByUrl,
  rotateImageUrlToFile,
  uploadSheetMaterialImage,
  type RotateDegrees
} from '@/lib/sheet-materials/image-upload'
import { uploadTenantMedia } from '@/lib/media/upload'
import { TENANT_MEDIA_BUCKET } from '@/lib/media/types'
import { cn } from '@/lib/utils'

type EntityImageFieldProps = {
  tenantId: string
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  error?: string
  /** Szálirányos anyag — hint + vékony vonalak az előnézeten. */
  showGrainHint?: boolean
  /**
   * legacy: sheet-materials / linear-materials bucket.
   * media: tenant-media + media_files (Excel Kep_fajlnev).
   */
  uploadMode?: 'legacy' | 'media'
}

export function EntityImageField({
  tenantId,
  value,
  onChange,
  disabled,
  error,
  showGrainHint = false,
  uploadMode = 'legacy'
}: EntityImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const busy = uploading || rotating

  /** Csak a régi anyag-bucket fájlt töröljük; a média könyvtár megmarad. */
  function cleanupLegacyUpload(url: string | null) {
    if (!url) return
    if (url.includes(`/object/public/${TENANT_MEDIA_BUCKET}/`)) return
    void removeSheetMaterialImageByUrl(url)
  }

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return
    setLocalError(null)
    setUploading(true)
    try {
      if (uploadMode === 'media') {
        const result = await uploadTenantMedia(tenantId, file)
        if (!result.ok) {
          setLocalError(result.message)
          return
        }
        cleanupLegacyUpload(value)
        onChange(result.file.public_url)
        return
      }
      const result = await uploadSheetMaterialImage(tenantId, file)
      if (!result.ok) {
        setLocalError(result.message)
        return
      }
      cleanupLegacyUpload(value)
      onChange(result.publicUrl)
    } finally {
      setUploading(false)
    }
  }

  async function handleRotate(degrees: RotateDegrees) {
    if (!value || disabled || busy) return
    setLocalError(null)
    setRotating(true)
    try {
      const rotated = await rotateImageUrlToFile(value, degrees)
      if (!rotated.ok) {
        setLocalError(rotated.message)
        return
      }
      if (uploadMode === 'media') {
        const uploaded = await uploadTenantMedia(tenantId, rotated.file)
        if (!uploaded.ok) {
          setLocalError(uploaded.message)
          return
        }
        cleanupLegacyUpload(value)
        onChange(uploaded.file.public_url)
        return
      }
      const uploaded = await uploadSheetMaterialImage(tenantId, rotated.file)
      if (!uploaded.ok) {
        setLocalError(uploaded.message)
        return
      }
      cleanupLegacyUpload(value)
      onChange(uploaded.publicUrl)
    } finally {
      setRotating(false)
    }
  }

  function handleRemove() {
    if (disabled || !value || busy) return
    cleanupLegacyUpload(value)
    onChange(null)
    setLocalError(null)
  }

  const shownError = error || localError

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex w-[11rem] flex-col gap-1.5 rounded-md border border-border bg-app p-2',
          shownError && 'border-danger'
        )}
      >
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded border border-border bg-surface">
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Anyag előnézet"
                className="size-full object-cover"
              />
              {showGrainHint ? (
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col justify-evenly px-2.5 py-2"
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
            </>
          ) : (
            <span className="px-2 text-center text-hint text-ink-muted">
              Nincs kép
            </span>
          )}
        </div>

        <p className="text-hint text-ink-secondary">JPG / PNG · max. 2 MB</p>
        {showGrainHint && value ? (
          <p className="text-hint text-ink-secondary">
            A vonalak a szálirányt jelzik — forgatással igazítsd a textúrát.
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          {value ? (
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={disabled || busy}
                loading={rotating}
                onClick={() => void handleRotate(-90)}
                aria-label="Forgatás balra 90 fok"
                title="90° balra"
              >
                <RotateCcw className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={disabled || busy}
                loading={rotating}
                onClick={() => void handleRotate(90)}
                aria-label="Forgatás jobbra 90 fok"
                title="90° jobbra"
              >
                <RotateCw className="size-3.5" aria-hidden />
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={disabled || busy}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {value ? 'Csere' : 'Feltöltés'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={disabled || busy}
            onClick={() => setPickerOpen(true)}
          >
            <FolderOpen className="size-3.5" aria-hidden />
            Médiából
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={disabled || busy}
              onClick={handleRemove}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Eltávolítás
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            void handleFile(file)
          }}
        />
      </div>
      {shownError ? (
        <p className="text-hint text-danger" role="alert">
          {shownError}
        </p>
      ) : null}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tenantId={tenantId}
        onSelect={(url) => {
          onChange(url)
          setLocalError(null)
        }}
      />
    </div>
  )
}
