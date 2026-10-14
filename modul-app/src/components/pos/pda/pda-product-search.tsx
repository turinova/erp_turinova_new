'use client'

import { Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { looksLikeBarcode } from '@/lib/pos/barcode'
import { searchPosProductsClient } from '@/lib/pos/search-client'
import { saleItemShelfGross } from '@/lib/pos/shelf-price'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 200

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
      const minLen = /^\d+$/.test(t) ? 4 : 2
      if (t.length < minLen || !warehouseId) {
        if (!t) {
          setRows([])
          setLoading(false)
        }
        return
      }
      // SKU / EAN gépelés: Enter = exact; ne fuzzy prefix lista
      if (looksLikeBarcode(t)) {
        setRows([])
        setLoading(false)
        return
      }
      const id = ++req.current
      setLoading(true)
      setError(null)
      const res = await searchPosProductsClient(t, warehouseId, {
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
    // Sticky lista törlés — Enter ne örököljön régi sort vonalkód scan közben
    req.current += 1
    setRows([])
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
    const t = q.trim()
    // Exact barcode előbb — fuzzy első sor ne írja felül a scannelést
    if (t && looksLikeBarcode(t)) {
      onBarcodeFallback(t)
      clear()
      return
    }
    const first = rows[0]
    if (first) {
      onPick(first)
      clear()
    }
  }

  const showList =
    q.trim().length >= 2 ||
    (/^\d+$/.test(q.trim()) && q.trim().length >= 4)

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
          aria-busy={loading}
          className="h-12 pl-11 text-[16px]"
        />
      </div>
      {error ? (
        <p className="text-hint text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}
      {showList ? (
        <ul
          className={cn(
            'max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-surface transition-opacity',
            loading && rows.length > 0 && 'opacity-60'
          )}
        >
          {loading && rows.length === 0 ? (
            <li className="px-3 py-2 text-hint text-ink-muted">Keresés…</li>
          ) : !loading && rows.length === 0 ? (
            <li className="px-3 py-2 text-hint text-ink-muted">
              Nincs találat: {q.trim()}
            </li>
          ) : (
            rows.map((p) => {
              const gross = saleItemShelfGross(p)
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
