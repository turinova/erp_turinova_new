'use client'

import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  removeCompanyLogoByUrl,
  uploadCompanyLogo
} from '@/lib/company/logo-upload'
import { cn } from '@/lib/utils'

type CompanyLogoFieldProps = {
  tenantId: string
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  error?: string
}

export function CompanyLogoField({
  tenantId,
  value,
  onChange,
  disabled,
  error
}: CompanyLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return
    setLocalError(null)
    setUploading(true)
    const result = await uploadCompanyLogo(tenantId, file)
    setUploading(false)
    if (!result.ok) {
      setLocalError(result.message)
      return
    }
    onChange(result.publicUrl)
  }

  function handleRemove() {
    if (disabled || !value) return
    void removeCompanyLogoByUrl(value)
    onChange(null)
    setLocalError(null)
  }

  const shownError = error || localError

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <div
        className={cn(
          'flex max-w-xl flex-col gap-2 rounded-md border border-border bg-app p-3',
          shownError && 'border-danger'
        )}
      >
        <div className="flex h-14 w-full max-w-[17.5rem] items-center justify-center overflow-hidden rounded border border-border bg-surface">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Cég logo"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-hint text-ink-muted">
              Nincs logo
            </span>
          )}
        </div>

        <p className="text-hint text-ink-secondary">
          Ajánlott: 1100×250 px · JPG / PNG / WebP · max. 2 MB
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || uploading}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {value ? 'Logo cseréje' : 'Logo feltöltése'}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger-ink hover:text-danger-ink"
              disabled={disabled || uploading}
              onClick={handleRemove}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Logo törlése
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {shownError ? (
        <p className="text-hint text-danger-ink" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
