'use client'

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
import type { MediaFileRow } from '@/lib/media/types'
import { createClient } from '@/lib/supabase/client'

type MediaPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  onSelect: (publicUrl: string) => void
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  tenantId,
  onSelect
}: MediaPickerDialogProps) {
  const [rows, setRows] = useState<MediaFileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setQuery('')
      const supabase = createClient()
      if (!supabase) {
        if (!cancelled) {
          setError('Nincs Supabase kapcsolat.')
          setLoading(false)
        }
        return
      }
      const { data, error: err } = await supabase
        .from('media_files')
        .select(
          'id, tenant_id, original_filename, stored_filename, storage_path, public_url, size_bytes, mime_type, created_at'
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
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
    void load()
    return () => {
      cancelled = true
    }
  }, [open, tenantId])

  const filtered = rows.filter((r) =>
    r.original_filename.toLowerCase().includes(query.trim().toLowerCase())
  )

  function confirmSelect(row: MediaFileRow | null) {
    if (!row) return
    const url = row.public_url?.trim()
    if (!url) {
      setError(
        'Ehhez a fájlhoz nincs publikus URL. Töltsd fel újra a Média oldalon.'
      )
      return
    }
    onSelect(url)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kép a médiából</DialogTitle>
          <DialogDescription>
            Kattints egy képre a kiválasztáshoz.
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.public_url}
                      alt=""
                      className="pointer-events-none size-10 shrink-0 rounded border border-border object-cover"
                    />
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
