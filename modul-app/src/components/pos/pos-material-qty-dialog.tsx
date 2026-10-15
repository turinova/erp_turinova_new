'use client'

import { useEffect, useId, useRef, useState } from 'react'

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
import {
  formatSaleQty,
  formatStockPiecesInput,
  materialQtyAllowsStockMode,
  materialQtyStockLabel,
  type MaterialQtyInputMode,
  parseStockPieceInput,
  saleUnitLabel,
  sellQtyFromMaterialInput,
  stockPiecesFromSellQty
} from '@/lib/sales/material-qty'
import { saleItemShelfGross } from '@/lib/pos/shelf-price'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  hit: SaleProductSearchItem | null
  onOpenChange: (open: boolean) => void
  onConfirm: (quantity: number) => void
}

const LS_SHEET = 'modul-pos-material-qty-mode-sheet'
const LS_LINEAR = 'modul-pos-material-qty-mode-linear'

function loadMode(
  kind: 'sheet_material' | 'linear_material',
  allowsStock: boolean
): MaterialQtyInputMode {
  if (!allowsStock) return 'sell'
  if (typeof window === 'undefined') return 'stock'
  const key = kind === 'sheet_material' ? LS_SHEET : LS_LINEAR
  const raw = window.localStorage.getItem(key)
  if (raw === 'sell' || raw === 'stock') return raw
  return 'stock'
}

function saveMode(
  kind: 'sheet_material' | 'linear_material',
  mode: MaterialQtyInputMode
) {
  if (typeof window === 'undefined') return
  const key = kind === 'sheet_material' ? LS_SHEET : LS_LINEAR
  window.localStorage.setItem(key, mode)
}

export function PosMaterialQtyDialog({
  open,
  hit,
  onOpenChange,
  onConfirm
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('1')
  const [mode, setMode] = useState<MaterialQtyInputMode>('stock')
  const [error, setError] = useState<string | null>(null)

  const kind = hit?.kind
  const isSheet = kind === 'sheet_material'
  const sellUnit = kind ? saleUnitLabel(kind) : 'm'
  const factor = hit?.area_or_length_factor ?? 0
  const stockUnit = hit?.stock_unit ?? null
  const allowsStock =
    kind === 'sheet_material' || kind === 'linear_material'
      ? materialQtyAllowsStockMode(kind, stockUnit)
      : false
  const stockLabel =
    kind === 'sheet_material' || kind === 'linear_material'
      ? materialQtyStockLabel(kind)
      : 'db'
  const activeMode: MaterialQtyInputMode =
    mode === 'stock' && allowsStock ? 'stock' : 'sell'
  const inputUnit = activeMode === 'stock' ? stockLabel : sellUnit

  useEffect(() => {
    if (!open || !hit) return
    if (hit.kind !== 'sheet_material' && hit.kind !== 'linear_material') return
    const allow = materialQtyAllowsStockMode(hit.kind, hit.stock_unit)
    const nextMode = loadMode(hit.kind, allow)
    setMode(nextMode)
    setRaw(nextMode === 'stock' && allow ? '1' : '1')
    setError(null)
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(t)
  }, [open, hit?.id]) // hit mezők: csak id változáskor reset

  const parsed =
    kind === 'sheet_material' || kind === 'linear_material'
      ? sellQtyFromMaterialInput({
          mode: activeMode,
          raw,
          kind,
          factor,
          stockUnit
        })
      : null

  const sellQty = parsed?.ok ? parsed.sellQty : null
  const unitGross = hit != null ? saleItemShelfGross(hit) : 0
  const gross =
    sellQty != null ? Math.round(sellQty * unitGross) : null

  const otherHint =
    sellQty != null && factor > 0
      ? activeMode === 'sell'
        ? stockUnit === 'fm' && !isSheet
          ? null
          : (() => {
              const pieces = stockPiecesFromSellQty(sellQty, factor)
              if (pieces == null) return null
              return `≈ ${pieces.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} ${stockLabel}`
            })()
        : `≈ ${formatSaleQty(sellQty, kind!)} ${sellUnit}`
      : null

  const stockPiecesTyped =
    activeMode === 'stock' ? parseStockPieceInput(raw) : null
  const overStock =
    sellQty != null &&
    hit != null &&
    ((hit.on_hand != null && sellQty > hit.on_hand + 1e-6) ||
      (stockPiecesTyped != null &&
        hit.on_hand_stock != null &&
        stockPiecesTyped > hit.on_hand_stock + 1e-6))

  function switchMode(next: MaterialQtyInputMode) {
    if (!hit || (hit.kind !== 'sheet_material' && hit.kind !== 'linear_material')) {
      return
    }
    if (next === 'stock' && !allowsStock) return
    if (next === activeMode) return

    const current = sellQtyFromMaterialInput({
      mode: activeMode,
      raw,
      kind: hit.kind,
      factor,
      stockUnit
    })
    if (current.ok && factor > 0) {
      if (next === 'stock') {
        setRaw(formatStockPiecesInput(current.sellQty, factor))
      } else {
        const n = current.sellQty
        setRaw(Number.isInteger(n) ? String(n) : String(n))
      }
    } else {
      setRaw('1')
    }
    setMode(next)
    saveMode(hit.kind, next)
    setError(null)
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  function applyPreset(n: number) {
    setRaw(String(n))
    setError(null)
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  function submit() {
    if (!hit || (kind !== 'sheet_material' && kind !== 'linear_material')) return
    const result = sellQtyFromMaterialInput({
      mode: activeMode,
      raw,
      kind,
      factor,
      stockUnit
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onConfirm(result.sellQty)
    onOpenChange(false)
  }

  if (!hit || (kind !== 'sheet_material' && kind !== 'linear_material')) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mennyiség</DialogTitle>
          <DialogDescription>
            {hit.name}
            {hit.machine_code ? ` · ${hit.machine_code}` : ''}
            {hit.size_label ? ` · ${hit.size_label}` : ''}
            {hit.on_hand != null ? (
              <>
                {' '}
                · Van kb. {formatSaleQty(hit.on_hand, kind)} {sellUnit}
                {hit.on_hand_stock != null
                  ? isSheet
                    ? ` (${formatSaleQty(hit.on_hand_stock, 'product')} tábla)`
                    : hit.stock_unit === 'fm'
                      ? ` (${formatSaleQty(hit.on_hand_stock, 'product')} fm)`
                      : ` (${formatSaleQty(hit.on_hand_stock, 'product')} szál)`
                  : null}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {allowsStock ? (
            <div className="flex gap-1.5" role="group" aria-label="Mennyiség egység">
              {(
                [
                  ['sell', sellUnit],
                  ['stock', stockLabel]
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={activeMode === value}
                  className={cn(
                    'min-h-9 flex-1 rounded-md border px-3 text-sm font-medium',
                    activeMode === value
                      ? 'border-ink bg-ink text-surface'
                      : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                  )}
                  onClick={() => switchMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={inputId} className="text-sm font-medium text-ink">
              Mennyiség ({inputUnit})
            </label>
            <Input
              ref={inputRef}
              id={inputId}
              inputMode="decimal"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              aria-invalid={Boolean(error)}
            />
            <p className="text-xs text-ink-muted">
              {activeMode === 'stock'
                ? `Egy tizedes, pl. 2,5 ${stockLabel}`
                : `Egy tizedes, pl. 1,5 ${sellUnit}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([0.5, 1, 2, 3] as const).map((n) => {
              const label = Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
              const value = String(n)
              return (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'min-h-9 min-w-10 rounded-md border px-2.5 text-sm tabular-nums',
                    raw === value || raw === label
                      ? 'border-ink bg-ink text-surface'
                      : 'border-border bg-surface text-ink hover:bg-subtle'
                  )}
                  onClick={() => applyPreset(n)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {otherHint && gross != null ? (
            <p className="text-sm text-ink-secondary">
              {otherHint} · {formatMoneyFt(gross)} Ft
            </p>
          ) : null}
          {overStock ? (
            <p className="text-sm text-warning-ink">
              Több, mint a jelzett készlet — soft figyelmeztetés, eladható.
            </p>
          ) : null}
          {error ? <p className="text-sm text-danger-ink">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" onClick={submit}>
            Kosárba
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
