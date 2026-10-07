'use client'

import { Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { looksLikeBarcode } from '@/lib/pos/barcode'
import { searchSaleProductsAction } from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 220

type Props = {
  warehouseId: string
  disabled?: boolean
  onPick: (product: SaleProductSearchItem) => void
  onBarcodeFallback: (code: string) => void
  onFocusChange?: (focused: boolean) => void
  className?: string
}

export function PdaProductSearch({
  warehouseId,
  disabled,
  onPick,
  onBarcodeFallback,
  onFocusChange,
  className
}: Props) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<SaleProductSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const req = useRef(0)

  const runSearch = useCallback(
    async (term: string) => {
      const t = term.trim()
      if (t.length < 2 || !warehouseId) {
        setRows([])
        setLoading(false)
        return
      }
      const id = ++req.current
      setLoading(true)
      setError(null)
      const res = await searchSaleProductsAction(t, warehouseId, {
        kind: 'product',
        includeMaterials: false,
        limit: 15,
        stockFirst: true
      })
      if (id !== req.current) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message)
        setRows([])
        return
      }
      setRows(res.rows)
    },
    [warehouseId]
  )

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void runSearch(q)
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q, runSearch])

  function clear() {
    setQ('')
    setRows([])
    setError(null)
  }

  function handleEnter() {
    const first = rows[0]
    if (first) {
      onPick(first)
      clear()
      return
    }
    const t = q.trim()
    if (t && looksLikeBarcode(t)) {
      onBarcodeFallback(t)
      clear()
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <Input
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleEnter()
            }
          }}
          placeholder="Vonalkód, SKU, gyártói, név…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 pl-11 text-[16px]"
        />
      </div>
      {error ? (
        <p className="text-hint text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}
      {q.trim().length >= 2 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-surface">
          {loading ? (
            <li className="px-3 py-2 text-hint text-ink-muted">Keresés…</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-2 text-hint text-ink-muted">Nincs találat</li>
          ) : (
            rows.map((p) => {
              const gross = Math.round(
                p.price_net * (1 + p.tax_rate_percent / 100)
              )
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-subtle"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(p)
                      clear()
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">
                        {p.display_name?.trim() || p.name}
                      </span>
                      <span className="block truncate text-hint text-ink-muted">
                        {p.sku}
                        {p.on_hand != null
                          ? ` · ${p.on_hand} ${p.unit_shortform || 'db'}`
                          : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-ink">
                      {formatMoneyFt(gross)} Ft
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
