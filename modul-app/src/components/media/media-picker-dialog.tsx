'use client'

import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { isPdfMime, type MediaFileRow } from '@/lib/media/types'
import { createClient } from '@/lib/supabase/client'

type MediaPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  onSelect: (publicUrl: string, row: MediaFileRow) => void
  /** Alapból kép; `pdf` = dokumentumválasztó. */
  kind?: 'image' | 'pdf'
}

const PICKER_LIMIT = 200

export function MediaPickerDialog({
  open,
  onOpenChange,
  tenantId,
  onSelect,
  kind = 'image'
}: MediaPickerDialogProps) {
  const [rows, setRows] = useState<MediaFileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const term = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        if (!cancelled) {
          setError('Nincs Supabase kapcsolat.')
          setLoading(false)
        }
        return
      }
      let q = supabase
        .from('media_files')
        .select(
          'id, tenant_id, original_filename, stored_filename, storage_path, public_url, size_bytes, mime_type, created_at'
        )
        .eq('tenant_id', tenantId)
        .like('mime_type', kind === 'pdf' ? 'application/pdf' : 'image/%')
        .order('created_at', { ascending: false })
        .limit(PICKER_LIMIT)
      if (term) q = q.ilike('original_filename', `%${term}%`)
      const { data, error: err } = await q
      if (cancelled) return
      if (err) {
        console.error('MediaPickerDialog', err.message)
        setError(`Nem sikerült betölteni a médiát: ${err.message}`)
        setRows([])
      } else {
        setRows((data ?? []) as MediaFileRow[])
      }
      setLoading(false)
    }
    const t = setTimeout(() => void load(), term ? 250 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, tenantId, kind, query])

  const filtered = rows

  function confirmSelect(row: MediaFileRow | null) {
    if (!row) return
    const url = row.public_url?.trim()
    if (!url) {
      setError(
        'Ehhez a fájlhoz nincs publikus URL. Töltsd fel újra a Média oldalon.'
      )
      return
    }
    onSelect(url, row)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kind === 'pdf' ? 'Dokumentum a médiából' : 'Kép a médiából'}</DialogTitle>
          <DialogDescription>
            {kind === 'pdf'
              ? 'Kattints egy PDF-re a kiválasztáshoz.'
              : 'Kattints egy képre a kiválasztáshoz.'}
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés fájlnévre…"
          autoComplete="off"
        />

        {error ? (
          <p className="text-body text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="max-h-[22rem] overflow-y-auto rounded-md border border-border">
          {loading ? (
            <p className="p-3 text-body text-ink-secondary">Betöltés…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-body text-ink-secondary">
              Nincs találat. Tölts fel fájlokat a Média oldalon, vagy használd
              a Feltöltés gombot.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-subtle"
                    onClick={() => confirmSelect(row)}
                  >
                    {isPdfMime(row.mime_type) ? (
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded border border-border bg-subtle text-ink-secondary">
                        <FileText className="size-4" aria-hidden />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.public_url}
                        alt=""
                        className="pointer-events-none size-10 shrink-0 rounded border border-border object-cover"
                      />
                    )}
                    <span className="min-w-0 truncate text-body text-ink">
                      {row.original_filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
