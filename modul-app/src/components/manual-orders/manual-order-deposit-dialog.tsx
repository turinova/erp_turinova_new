'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
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
import { Textarea } from '@/components/ui/textarea'
import { addManualDepositAction } from '@/lib/manual-orders/actions'
import { MO_DEPOSIT_METHOD_LABEL, type MoDepositMethod } from '@/lib/manual-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

const METHODS = Object.keys(MO_DEPOSIT_METHOD_LABEL) as MoDepositMethod[]

function parseAmount(raw: string): number | null {
  const v = Number(raw.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null
}

export function ManualOrderDepositDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  totalGross,
  paid,
  priceMissing,
  onDone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  orderNumber: string
  totalGross: number
  paid: number
  /** Van ár nélküli tétel → a hátralék nem végleges, felülírható. */
  priceMissing: boolean
  onDone: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const remaining = Math.max(0, totalGross - paid)
  const [amountRaw, setAmountRaw] = useState('')
  const [method, setMethod] = useState<MoDepositMethod>('keszpenz')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setAmountRaw('')
    setMethod('keszpenz')
    setNote('')
    setError(null)
  }, [open])

  const amount = parseAmount(amountRaw)
  const chips =
    remaining > 0
      ? [
          { label: '30%', value: Math.round(remaining * 0.3) },
          { label: '50%', value: Math.round(remaining * 0.5) },
          { label: 'Teljes', value: remaining }
        ].filter((c, i, arr) => c.value > 0 && arr.findIndex((x) => x.value === c.value) === i)
      : []
  const over = amount !== null && !priceMissing && amount > remaining

  function confirm() {
    if (amount === null) {
      setError('Adj meg pozitív összeget.')
      return
    }
    if (over) {
      setError(`Az összeg nem lehet nagyobb a hátraléknál (${formatMoneyFt(remaining)} Ft).`)
      return
    }
    startTransition(async () => {
      const res = await addManualDepositAction({ orderId, amount, method, note })
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success('Előleg rögzítve.')
      onOpenChange(false)
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        className="max-w-[520px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Előleg rögzítése</DialogTitle>
          <DialogDescription>Befizetés a(z) {orderNumber} rendeléshez.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-subtle/50 p-3 text-body">
            <p className="text-ink-secondary">
              Bruttó: <strong className="tabular-nums text-ink">{formatMoneyFt(totalGross)} Ft</strong>
              {priceMissing ? <span className="text-warning-ink"> (nem végleges)</span> : null}
            </p>
            <p className="text-ink-secondary">
              Eddig befizetve: <strong className="tabular-nums text-ink">{formatMoneyFt(paid)} Ft</strong>
            </p>
            <p className="mt-1 font-medium text-ink">
              Hátralék: <span className="tabular-nums">{formatMoneyFt(remaining)} Ft</span>
            </p>
          </div>

          <FormField label="Összeg" htmlFor="mo-dep-amount" required>
            <div className="relative">
              <Input
                id="mo-dep-amount"
                inputMode="numeric"
                value={amountRaw}
                disabled={pending}
                onChange={(e) => {
                  setAmountRaw(e.target.value)
                  setError(null)
                }}
                className="pr-10 tabular-nums"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-secondary">
                Ft
              </span>
            </div>
            {chips.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setAmountRaw(String(c.value))
                      setError(null)
                    }}
                    className={cn(
                      'rounded-md border border-border px-2 py-1 text-hint font-medium text-ink-secondary hover:bg-subtle hover:text-ink',
                      amount === c.value && 'border-ink bg-subtle text-ink'
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : null}
          </FormField>

          <FormField label="Fizetési mód" htmlFor="mo-dep-method" required>
            <div id="mo-dep-method" className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Fizetési mód">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  disabled={pending}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'h-8 rounded-md border px-3 text-[13px] font-medium transition-colors',
                    method === m ? 'border-ink bg-ink text-white' : 'border-border bg-surface text-ink hover:bg-subtle'
                  )}
                >
                  {MO_DEPOSIT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Megjegyzés" htmlFor="mo-dep-note" optionalLabel>
            <Textarea id="mo-dep-note" rows={2} value={note} disabled={pending} onChange={(e) => setNote(e.target.value)} />
          </FormField>

          {error ? (
            <p className="text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button loading={pending} onClick={confirm}>
            Előleg rögzítése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
