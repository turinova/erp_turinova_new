'use client'

import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  removeSheetMaterialImageByUrl,
  uploadSheetMaterialImage
} from '@/lib/sheet-materials/image-upload'
import { cn } from '@/lib/utils'

type SheetMaterialImageFieldProps = {
  tenantId: string
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  error?: string
}

export function SheetMaterialImageField({
  tenantId,
  value,
  onChange,
  disabled,
  error
}: SheetMaterialImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return
    setLocalError(null)
    setUploading(true)
    const result = await uploadSheetMaterialImage(tenantId, file)
    setUploading(false)
    if (!result.ok) {
      setLocalError(result.message)
      return
    }
    if (value) {
      void removeSheetMaterialImageByUrl(value)
    }
    onChange(result.publicUrl)
  }

  function handleRemove() {
    if (disabled || !value) return
    void removeSheetMaterialImageByUrl(value)
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
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded border border-border bg-surface">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Anyag előnézet"
              className="size-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-hint text-ink-muted">
              Nincs kép
            </span>
          )}
        </div>

        <p className="text-hint text-ink-secondary">JPG / PNG · max. 2 MB</p>

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={disabled || uploading}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {value ? 'Csere' : 'Feltöltés'}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={disabled || uploading}
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
          disabled={disabled || uploading}
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
    </div>
  )
}
