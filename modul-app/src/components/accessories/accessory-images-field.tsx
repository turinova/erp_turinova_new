'use client'

import {
  FolderOpen,
  ImagePlus,
  Star,
  Trash2
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { MediaPickerDialog } from '@/components/media/media-picker-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadTenantMedia } from '@/lib/media/upload'
import { cn } from '@/lib/utils'

export const ACCESSORY_MAX_IMAGES = 10

export type AccessoryImagesValue = {
  primaryUrl: string | null
  galleryUrls: string[]
}

type AccessoryImagesFieldProps = {
  tenantId: string
  value: AccessoryImagesValue
  onChange: (next: AccessoryImagesValue) => void
  disabled?: boolean
  error?: string
  maxImages?: number
  /** Kép URL → leírás (alt). Ha nincs megadva, nincs leírás mező. */
  alts?: Record<string, string>
  onAltsChange?: (next: Record<string, string>) => void
}

function normalizeUrls(
  primaryUrl: string | null,
  galleryUrls: string[]
): AccessoryImagesValue {
  const primary = primaryUrl?.trim() || null
  const seen = new Set<string>()
  const gallery: string[] = []
  for (const raw of galleryUrls) {
    const u = raw.trim()
    if (!u || u === primary || seen.has(u)) continue
    seen.add(u)
    gallery.push(u)
  }
  return { primaryUrl: primary, galleryUrls: gallery }
}

/** Összes URL sorrendben: fő elöl. */
export function accessoryImageList(value: AccessoryImagesValue): string[] {
  const n = normalizeUrls(value.primaryUrl, value.galleryUrls)
  return n.primaryUrl ? [n.primaryUrl, ...n.galleryUrls] : [...n.galleryUrls]
}

export function AccessoryImagesField({
  tenantId,
  value,
  onChange,
  disabled,
  error,
  maxImages = ACCESSORY_MAX_IMAGES,
  alts,
  onAltsChange
}: AccessoryImagesFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const normalized = normalizeUrls(value.primaryUrl, value.galleryUrls)
  const all = accessoryImageList(normalized)
  const atMax = all.length >= maxImages
  const shownError = error || localError

  function emit(primaryUrl: string | null, galleryUrls: string[]) {
    onChange(normalizeUrls(primaryUrl, galleryUrls))
    setLocalError(null)
  }

  function addUrl(url: string): boolean {
    const u = url.trim()
    if (!u) {
      const msg = 'A kiválasztott képnek nincs URL-je.'
      setLocalError(msg)
      toast.error(msg)
      return false
    }
    if (all.includes(u)) {
      toast.message('Ez a kép már hozzá van adva.')
      return false
    }
    if (all.length >= maxImages) {
      const msg = `Legfeljebb ${maxImages} kép adható hozzá.`
      setLocalError(msg)
      toast.error(msg)
      return false
    }
    if (!normalized.primaryUrl) {
      emit(u, normalized.galleryUrls)
    } else {
      emit(normalized.primaryUrl, [...normalized.galleryUrls, u])
    }
    toast.success('Kép hozzáadva.')
    return true
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || disabled) return
    const list = Array.from(files)
    if (list.length === 0) return
    setLocalError(null)
    setUploading(true)
    let added = 0
    try {
      let primary = normalized.primaryUrl
      const gallery = [...normalized.galleryUrls]
      let count = (primary ? 1 : 0) + gallery.length

      for (const file of list) {
        if (count >= maxImages) {
          const msg = `Legfeljebb ${maxImages} kép adható hozzá.`
          setLocalError(msg)
          toast.error(msg)
          break
        }
        const result = await uploadTenantMedia(tenantId, file)
        if (!result.ok) {
          setLocalError(result.message)
          toast.error(result.message)
          break
        }
        const u = result.file.public_url?.trim()
        if (!u) {
          const msg = 'A feltöltés sikerült, de nincs publikus URL.'
          setLocalError(msg)
          toast.error(msg)
          break
        }
        if (primary === u || gallery.includes(u)) continue
        if (!primary) {
          primary = u
        } else {
          gallery.push(u)
        }
        count += 1
        added += 1
      }
      if (added > 0) {
        emit(primary, gallery)
        toast.success(
          added === 1 ? 'Kép feltöltve.' : `${added} kép feltöltve.`
        )
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'A kép feltöltése sikertelen.'
      setLocalError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  function setPrimary(url: string) {
    if (disabled || !url) return
    if (normalized.primaryUrl === url) return
    const rest = all.filter((u) => u !== url)
    emit(url, rest)
  }

  function removeUrl(url: string) {
    if (disabled) return
    if (normalized.primaryUrl === url) {
      const [nextPrimary, ...rest] = normalized.galleryUrls
      emit(nextPrimary ?? null, rest)
      return
    }
    emit(
      normalized.primaryUrl,
      normalized.galleryUrls.filter((u) => u !== url)
    )
  }

  return (
    <div className="col-span-full space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || uploading || atMax}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-3.5" aria-hidden />
          Feltöltés
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || uploading || atMax}
          onClick={() => setPickerOpen(true)}
        >
          <FolderOpen className="size-3.5" aria-hidden />
          Médiából
        </Button>
        <p className="self-center text-hint text-ink-secondary">
          JPG / PNG · max. 2 MB · legfeljebb {maxImages} kép
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : []
          e.target.value = ''
          void handleFiles(files)
        }}
      />

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center">
          <p className="text-body text-ink-secondary">
            Még nincs kép. Webshophoz kötelező a fő kép.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={disabled || uploading}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            Első kép feltöltése
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {all.map((url) => {
            const isPrimary = normalized.primaryUrl === url
            return (
              <li
                key={url}
                className={cn(
                  'flex flex-col gap-1.5 rounded-md border bg-app p-1.5',
                  isPrimary ? 'border-primary' : 'border-border'
                )}
              >
                <div className="relative aspect-square overflow-hidden rounded border border-border bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={isPrimary ? 'Fő kép' : 'Termék kép'}
                    className="size-full object-cover"
                  />
                  {isPrimary ? (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary px-1 py-0.5 text-[10px] font-semibold text-white">
                      <Star className="size-2.5" aria-hidden />
                      Fő
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  {alts && onAltsChange ? (
                    <div className="space-y-0.5">
                      <label
                        htmlFor={`img-alt-${all.indexOf(url)}`}
                        className="text-hint text-ink-secondary"
                      >
                        Mit mutat a kép?
                      </label>
                      <Input
                        id={`img-alt-${all.indexOf(url)}`}
                        value={alts[url] ?? ''}
                        maxLength={200}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = { ...alts }
                          if (e.target.value) next[url] = e.target.value
                          else delete next[url]
                          onAltsChange(next)
                        }}
                      />
                    </div>
                  ) : null}
                  {!isPrimary ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={disabled}
                      onClick={() => setPrimary(url)}
                    >
                      <Star className="size-3.5" aria-hidden />
                      Fő képnek
                    </Button>
                  ) : (
                    <p className="px-0.5 text-center text-hint text-ink-secondary">
                      Fő kép (lista, bolt, feed)
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-danger-ink"
                    disabled={disabled}
                    onClick={() => removeUrl(url)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Eltávolítás
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

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
          addUrl(url)
        }}
      />
    </div>
  )
}
