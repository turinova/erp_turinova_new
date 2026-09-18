'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  searchSalesForReturnAction,
  type SaleReturnSearchHit
} from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PosReturnSearchDialog({ open, onOpenChange }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<SaleReturnSearchHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setQ('')
    setRows([])
    setError(null)
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const safe = q.trim()
    if (safe.length < 1) {
      setRows([])
      return
    }
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchSalesForReturnAction(safe)
        if (!result.ok) {
          setError(result.message)
          setRows([])
          return
        }
        setError(null)
        setRows(result.rows)
      })
    }, 200)
    return () => window.clearTimeout(handle)
  }, [q, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Visszáru — eladás keresése</DialogTitle>
          <p className="mt-1 text-hint text-ink-secondary">
            Írd be az eladás számát vagy az ügyfél nevét, majd nyisd meg.
          </p>
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-4 py-3">
          <label className="sr-only" htmlFor="pos-return-q">
            Keresés
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              ref={inputRef}
              id="pos-return-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-2026-001 / ügyfél…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="px-4 py-3 text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
          {!error && q.trim() && rows.length === 0 && !pending ? (
            <p className="px-4 py-6 text-body text-ink-secondary">
              Nincs találat — csak teljesített / részben visszáru eladások.
            </p>
          ) : null}
          {!q.trim() ? (
            <p className="px-4 py-6 text-body text-ink-secondary">
              Kezdj el gépelni az eladás számát.
            </p>
          ) : null}
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle"
                  onClick={() => {
                    onOpenChange(false)
                    router.push(`/ertekesitesek/${row.id}?return=1`)
                  }}
                >
                  <span>
                    <span className="font-semibold text-ink">
                      {row.sale_number}
                    </span>
                    <span className="mt-0.5 block text-hint text-ink-secondary">
                      {row.customer_name ?? 'Vendég'}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatMoneyFt(row.total_gross)} Ft
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
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
