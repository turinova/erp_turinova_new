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
  parseSaleMaterialQtyInput,
  roundSaleMaterialQty,
  saleUnitLabel
} from '@/lib/sales/material-qty'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleProductSearchItem } from '@/lib/sales/queries'

type Props = {
  open: boolean
  hit: SaleProductSearchItem | null
  onOpenChange: (open: boolean) => void
  onConfirm: (quantity: number) => void
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
  const [error, setError] = useState<string | null>(null)

  const kind = hit?.kind
  const isSheet = kind === 'sheet_material'
  const unit = kind ? saleUnitLabel(kind) : 'm'
  const factor = hit?.area_or_length_factor ?? 0

  useEffect(() => {
    if (!open) return
    setRaw('1')
    setError(null)
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(t)
  }, [open, hit?.id])

  const qty = parseSaleMaterialQtyInput(raw)
  const gross =
    qty != null && hit
      ? Math.round(qty * Math.round(hit.price_net * (1 + hit.tax_rate_percent / 100)))
      : null

  const stockHint =
    qty != null && factor > 0
      ? isSheet
        ? `≈ ${(qty / factor).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} tábla`
        : hit?.stock_unit === 'fm'
          ? `≈ ${formatSaleQty(qty, 'linear_material')} fm`
          : `≈ ${(qty / factor).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} szál`
      : null

  function submit() {
    const parsed = parseSaleMaterialQtyInput(raw)
    if (parsed == null) {
      setError(`Adj meg legalább 0,1 ${unit} mennyiséget.`)
      return
    }
    onConfirm(roundSaleMaterialQty(parsed))
    onOpenChange(false)
  }

  if (!hit || (kind !== 'sheet_material' && kind !== 'linear_material')) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSheet ? 'Hány négyzetméter?' : 'Hány méter?'}
          </DialogTitle>
          <DialogDescription>
            {hit.name}
            {hit.size_label ? ` · ${hit.size_label}` : ''}
            {hit.on_hand != null ? (
              <>
                {' '}
                · Van kb. {formatSaleQty(hit.on_hand, kind)} {unit}
                {hit.on_hand_stock != null
                  ? isSheet
                    ? ` (${formatSaleQty(hit.on_hand_stock, 'product')} tábla)`
                    : hit.stock_unit === 'fm'
                      ? ` (${formatSaleQty(hit.on_hand_stock, 'product')} fm)`
                      : ` (${formatSaleQty(hit.on_hand_stock, 'product')} db)`
                  : null}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-700">
            Mennyiség ({unit})
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
          <p className="text-xs text-zinc-500">Egy tizedes, pl. 1,5</p>
          {stockHint && gross != null ? (
            <p className="text-sm text-zinc-600">
              {stockHint} · {formatMoneyFt(gross)} Ft
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
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
