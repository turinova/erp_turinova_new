'use client'

import { FileText, Link2, Trash2, Upload } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { deleteMediaFile, linkMediaToProducts } from '@/lib/media/actions'
import { MEDIA_LIST_LIMIT, type MediaKindFilter } from '@/lib/media/queries'
import { isPdfMime, MEDIA_ACCEPT, type MediaFileRow } from '@/lib/media/types'
import { listTenantMediaFilenames, uploadTenantMedia } from '@/lib/media/upload'
import { createClient } from '@/lib/supabase/client'
import { formatHuNumber } from '@/lib/sheet-materials/parse'

type MediaLibraryClientProps = {
  tenantId: string
  initialRows: MediaFileRow[]
  canWrite: boolean
  kind: MediaKindFilter
}

const KIND_TABS: { kind: MediaKindFilter; label: string; href: string }[] = [
  { kind: 'all', label: 'Összes', href: '/torzsadatok/rendszer/media' },
  { kind: 'image', label: 'Képek', href: '/torzsadatok/rendszer/media?tipus=kep' },
  { kind: 'pdf', label: 'Dokumentumok', href: '/torzsadatok/rendszer/media?tipus=dokumentum' }
]

export function MediaLibraryClient({
  tenantId,
  initialRows,
  canWrite,
  kind
}: MediaLibraryClientProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState(initialRows)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [overwrite, setOverwrite] = useState(false)
  const [progress, setProgress] = useState<{
    done: number
    total: number
    failed: number
    skipped: number
  } | null>(null)

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    if (!uploading) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  async function handleFiles(files: File[]) {
    if (!canWrite || files.length === 0) return
    setUploading(true)
    const failed: string[] = []
    let okCount = 0
    const added: MediaFileRow[] = []
    try {
      // Tömeges feltöltésnél a már meglévő nevű fájlt kihagyjuk, így a mappa újra feltölthető.
      const known = await listTenantMediaFilenames(tenantId)
      const todo = files.filter((f) => !known.has(f.name.trim().toLowerCase()))
      const skipped = files.length - todo.length
      const userId = (await createClient()?.auth.getUser())?.data.user?.id ?? null
      setProgress({ done: 0, total: todo.length, failed: 0, skipped })

      for (const file of todo) {
        const result = await uploadTenantMedia(tenantId, file, { knownFilenames: known, userId })
        if (result.ok) {
          okCount += 1
          known.add(result.file.original_filename.toLowerCase())
          added.unshift(result.file)
        } else {
          failed.push(file.name)
          console.warn('media upload', file.name, result.message)
          if (todo.length <= 5) toast.error(`${file.name}: ${result.message}`)
        }
        setProgress({ done: okCount + failed.length, total: todo.length, failed: failed.length, skipped })
      }
      setRows((prev) => [...added, ...prev].slice(0, MEDIA_LIST_LIMIT))
      if (okCount > 0) {
        toast.success(
          `${formatHuNumber(okCount)} fájl feltöltve.${skipped > 0 ? ` ${formatHuNumber(skipped)} már megvolt, kihagytam.` : ''}`
        )
        router.refresh()
      } else if (skipped > 0 && failed.length === 0) {
        toast.success(`Mind a ${formatHuNumber(skipped)} fájl megvolt már, nem töltöttem fel újra.`)
      }
      if (failed.length > 0) {
        toast.error(
          `${formatHuNumber(failed.length)} fájl nem töltődött fel (pl. ${failed.slice(0, 3).join(', ')}). Válaszd ki újra ugyanazokat a fájlokat — a meglévőket kihagyom.`,
          { duration: Infinity }
        )
      }
    } catch (err) {
      console.error('media upload', err)
      toast.error(
        err instanceof Error ? err.message : 'A feltöltés váratlanul megszakadt.'
      )
    } finally {
      setUploading(false)
    }
  }

  function handleLink() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await linkMediaToProducts({ overwrite })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    })
  }

  function handleDelete(id: string, name: string) {
    if (!canWrite) return
    if (
      !window.confirm(
        `Törlöd a fájlt: ${name}? A termékekhez csatolt dokumentumként is eltűnik.`
      )
    )
      return
    startTransition(async () => {
      const result = await deleteMediaFile(id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Média"
        description="Képek és PDF dokumentumok a termékekhez — fájlnév alapján Excel és összekapcsolás."
        actions={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                loading={pending}
                onClick={handleLink}
              >
                <Link2 className="size-3.5" aria-hidden />
                Összekapcsolás termékekkel
              </Button>
              <Button
                type="button"
                loading={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-3.5" aria-hidden />
                Feltöltés
              </Button>
            </div>
          ) : null
        }
      />

      {progress ? (
        <p role="status" aria-live="polite" className="text-body text-ink-secondary">
          {uploading ? 'Feltöltés: ' : 'Utolsó feltöltés: '}
          <span className="font-medium text-ink tabular-nums">
            {formatHuNumber(progress.done)} / {formatHuNumber(progress.total)}
          </span>
          {progress.failed > 0 ? ` · ${formatHuNumber(progress.failed)} hiba` : ''}
          {progress.skipped > 0 ? ` · ${formatHuNumber(progress.skipped)} már megvolt` : ''}
          {uploading ? ' — ne zárd be az oldalt.' : ''}
        </p>
      ) : null}

      {canWrite ? (
        <label className="flex items-center gap-2 text-body text-ink-secondary">
          <input
            type="checkbox"
            className="size-3.5 rounded border-border"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          Összekapcsoláskor felülírja a meglévő képeket
        </label>
      ) : null}

      <p className="max-w-2xl text-body text-ink-secondary">
        Termék: fájlnév stem = SKU vagy vonalkód. Táblás: csak egyedi gépkód.
        Excel: <code className="text-hint">Kep_fajlnev</code> oszlop. PDF (legfeljebb 10 MB):
        használati útmutató, biztonsági adatlap — a termék szerkesztőjében csatolható.
      </p>

      <nav aria-label="Fájltípus" className="flex flex-wrap items-center gap-1">
        {KIND_TABS.map((t) => (
          <Link
            key={t.kind}
            href={t.href}
            aria-current={t.kind === kind ? 'page' : undefined}
            className={
              t.kind === kind
                ? 'rounded-md bg-ink px-2.5 py-1 text-body font-medium text-white'
                : 'rounded-md px-2.5 py-1 text-body text-ink-secondary hover:bg-subtle hover:text-ink'
            }
          >
            {t.label}
          </Link>
        ))}
        {rows.length >= MEDIA_LIST_LIMIT ? (
          <span className="ml-1 text-hint text-ink-muted">
            A legutóbbi {MEDIA_LIST_LIMIT} fájl látszik.
          </span>
        ) : null}
      </nav>

      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        className="sr-only"
        disabled={!canWrite || uploading}
        onChange={(e) => {
          // Fontos: a FileList-et azonnal tömbbe másoljuk — value törlés
          // után a böngésző gyakran kiüríti az eredeti listát.
          const files = e.target.files ? Array.from(e.target.files) : []
          e.target.value = ''
          void handleFiles(files)
        }}
      />

      {rows.length === 0 ? (
        <p className="rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary">
          Még nincs feltöltött fájl.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-body">
            <thead className="border-b border-border bg-subtle text-ink-secondary">
              <tr>
                <th className="px-2.5 py-2 font-medium">Előnézet</th>
                <th className="px-2.5 py-2 font-medium">Fájlnév</th>
                <th className="px-2.5 py-2 font-medium">Méret</th>
                <th className="px-2.5 py-2 font-medium">Dátum</th>
                {canWrite ? (
                  <th className="px-2.5 py-2 font-medium">Művelet</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-2.5 py-2">
                    {isPdfMime(row.mime_type) ? (
                      <a
                        href={row.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${row.original_filename} megnyitása`}
                        className="inline-flex size-12 items-center justify-center rounded border border-border bg-subtle text-ink-secondary hover:text-ink"
                      >
                        <FileText className="size-5" aria-hidden />
                      </a>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.public_url}
                        alt=""
                        className="size-12 rounded border border-border object-cover"
                      />
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-ink">{row.original_filename}</td>
                  <td className="px-2.5 py-2 text-ink-secondary">
                    {formatHuNumber(Math.round(row.size_bytes / 1024))} KB
                  </td>
                  <td className="px-2.5 py-2 text-ink-secondary">
                    {new Date(row.created_at).toLocaleString('hu-HU')}
                  </td>
                  {canWrite ? (
                    <td className="px-2.5 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          handleDelete(row.id, row.original_filename)
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Törlés
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
