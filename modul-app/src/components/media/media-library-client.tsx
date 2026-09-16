'use client'

import { Link2, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { deleteMediaFile, linkMediaToProducts } from '@/lib/media/actions'
import type { MediaFileRow } from '@/lib/media/types'
import { uploadTenantMedia } from '@/lib/media/upload'
import { formatHuNumber } from '@/lib/sheet-materials/parse'

type MediaLibraryClientProps = {
  tenantId: string
  initialRows: MediaFileRow[]
  canWrite: boolean
}

export function MediaLibraryClient({
  tenantId,
  initialRows,
  canWrite
}: MediaLibraryClientProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState(initialRows)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [overwrite, setOverwrite] = useState(false)

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  async function handleFiles(files: File[]) {
    if (!canWrite || files.length === 0) return
    setUploading(true)
    let okCount = 0
    let failCount = 0
    const next = [...rows]
    try {
      for (const file of files) {
        const result = await uploadTenantMedia(tenantId, file)
        if (result.ok) {
          okCount += 1
          next.unshift(result.file)
        } else {
          failCount += 1
          toast.error(`${file.name}: ${result.message}`)
        }
      }
      setRows(next)
      if (okCount > 0) {
        toast.success(`${okCount} fájl feltöltve.`)
        router.refresh()
      }
      if (failCount > 0 && okCount === 0) {
        toast.error('A feltöltés sikertelen.')
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
    if (!window.confirm(`Törlöd a fájlt: ${name}?`)) return
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
        description="Képek a törzsadatokhoz — fájlnév alapján Excel és összekapcsolás."
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
        Excel: <code className="text-hint">Kep_fajlnev</code> oszlop.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.public_url}
                      alt=""
                      className="size-12 rounded border border-border object-cover"
                    />
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
