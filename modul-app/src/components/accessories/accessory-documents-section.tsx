'use client'

import { ArrowDown, ArrowUp, ExternalLink, FileText, FolderOpen, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { MediaPickerDialog } from '@/components/media/media-picker-dialog'
import { FormSection } from '@/components/patterns/form-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  attachAccessoryDocument,
  getAccessoryDocuments,
  moveAccessoryDocument,
  removeAccessoryDocument,
  updateAccessoryDocument,
  type AccessoryDocument,
  type DocumentActionResult
} from '@/lib/accessories/document-actions'
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  DOCUMENT_LANGUAGES,
  DOCUMENT_TITLE_MAX,
  isDocumentKind,
  MAX_DOCUMENTS_PER_PRODUCT
} from '@/lib/accessories/document-kinds'
import { uploadTenantMedia } from '@/lib/media/upload'

const KIND_OPTIONS = DOCUMENT_KINDS.map((k) => ({ value: k, label: DOCUMENT_KIND_LABEL[k] }))
const LANGUAGE_OPTIONS = DOCUMENT_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('hu-HU')} KB`
}

function TitleInput({
  doc,
  disabled,
  onSave
}: {
  doc: AccessoryDocument
  disabled: boolean
  onSave: (title: string) => void
}) {
  const [value, setValue] = useState(doc.title)
  useEffect(() => setValue(doc.title), [doc.title])
  return (
    <Input
      aria-label="Dokumentum címe"
      value={value}
      maxLength={DOCUMENT_TITLE_MAX}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim()
        if (!next) setValue(doc.title)
        else if (next !== doc.title) onSave(next)
      }}
    />
  )
}

/** PDF dokumentumok (útmutató, biztonsági adatlap…) a médiatárból — a termékoldalon letölthetők. */
export function AccessoryDocumentsSection({
  accessoryId,
  tenantId,
  disabled,
  embedded = false
}: {
  accessoryId: string
  tenantId: string
  disabled: boolean
  embedded?: boolean
}) {
  const [items, setItems] = useState<AccessoryDocument[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    void getAccessoryDocuments(accessoryId).then((r) => {
      if (alive && r.ok) setItems(r.items)
    })
    return () => {
      alive = false
    }
  }, [accessoryId])

  function run(action: () => Promise<DocumentActionResult>, success?: string) {
    startTransition(async () => {
      const r = await action()
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setItems(r.items)
      if (success) toast.success(success)
    })
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const up = await uploadTenantMedia(tenantId, file)
      if (!up.ok) {
        toast.error(up.message)
        return
      }
      if (up.file.mime_type !== 'application/pdf') {
        toast.error('A fájl bekerült a médiába, de dokumentumként csak PDF csatolható.')
        return
      }
      run(() => attachAccessoryDocument(accessoryId, up.file.id), 'Dokumentum feltöltve és csatolva.')
    } finally {
      setUploading(false)
    }
  }

  const full = items.length >= MAX_DOCUMENTS_PER_PRODUCT
  const busy = disabled || pending || uploading

  return (
    <FormSection
      embedded={embedded}
      title="Dokumentumok"
      description="Használati útmutató, biztonsági adatlap, megfelelőségi nyilatkozat — PDF, legfeljebb 10 MB. A termékoldalon letölthető, és a keresők is látják."
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          disabled={busy || full}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" aria-hidden />
          PDF feltöltése
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || full}
          onClick={() => setPickerOpen(true)}
        >
          <FolderOpen className="size-3.5" aria-hidden />
          Választás a médiából
        </Button>
        {full ? (
          <span className="text-hint text-ink-secondary">
            Elérted a {MAX_DOCUMENTS_PER_PRODUCT} dokumentumos korlátot.
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleUpload(file)
          }}
        />
      </div>

      {items.length === 0 ? (
        <p className="text-hint text-ink-secondary">
          Nincs csatolt dokumentum. Ha a termékhez tartozik útmutató vagy adatlap, töltsd fel PDF-ben.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((d, i) => (
            <li key={d.id} className="grid gap-2 px-2 py-2 md:grid-cols-[minmax(0,1fr)_12rem_8rem_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-ink-secondary" aria-hidden />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <TitleInput
                    doc={d}
                    disabled={busy}
                    onSave={(title) =>
                      run(() => updateAccessoryDocument(accessoryId, d.id, { title }), 'Cím mentve.')
                    }
                  />
                  <p className="truncate text-hint text-ink-secondary">
                    {d.filename} · {formatSize(d.sizeBytes)}
                  </p>
                </div>
              </div>
              <MenuSelect
                value={d.kind}
                allowEmpty={false}
                disabled={busy}
                options={KIND_OPTIONS}
                onChange={(v) => {
                  if (isDocumentKind(v) && v !== d.kind) {
                    run(() => updateAccessoryDocument(accessoryId, d.id, { kind: v }))
                  }
                }}
              />
              <MenuSelect
                value={d.language}
                allowEmpty={false}
                disabled={busy}
                options={LANGUAGE_OPTIONS}
                onChange={(v) => {
                  if (v && v !== d.language) {
                    run(() => updateAccessoryDocument(accessoryId, d.id, { language: v }))
                  }
                }}
              />
              <div className="flex items-center justify-end gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Feljebb"
                  disabled={busy || i === 0}
                  onClick={() => run(() => moveAccessoryDocument(accessoryId, d.id, 'up'))}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Lejjebb"
                  disabled={busy || i === items.length - 1}
                  onClick={() => run(() => moveAccessoryDocument(accessoryId, d.id, 'down'))}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </Button>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${d.title} megnyitása`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger-ink"
                  disabled={busy}
                  onClick={() => run(() => removeAccessoryDocument(accessoryId, d.id), 'Dokumentum leválasztva.')}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Leválasztás
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tenantId={tenantId}
        kind="pdf"
        onSelect={(_url, row) =>
          run(() => attachAccessoryDocument(accessoryId, row.id), 'Dokumentum csatolva.')
        }
      />
    </FormSection>
  )
}
