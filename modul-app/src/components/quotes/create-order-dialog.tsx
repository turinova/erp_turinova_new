'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { convertQuoteToOrder } from '@/lib/quotes/actions'
import {
  formatPaymentAmountInput,
  parsePaymentAmount,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TOLERANCE_GROSS,
  quoteRemainingGross,
  roundQuoteMoney,
  type PaymentStatus
} from '@/lib/quotes/payment-labels'
import { cn } from '@/lib/utils'

type CreateOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  quoteNumber: string
  totalGross: number
  currency: string
  paymentMethods: PaymentMethodOption[]
  onSuccess: () => void
}

function previewStatus(
  amount: number,
  totalGross: number
): { status: PaymentStatus; remaining: number } {
  const remaining = quoteRemainingGross(totalGross, amount)
  if (amount <= 0) return { status: 'not_paid', remaining: totalGross }
  if (amount >= totalGross - PAYMENT_TOLERANCE_GROSS) {
    return { status: 'paid', remaining: 0 }
  }
  return { status: 'partial', remaining }
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  totalGross,
  currency,
  paymentMethods,
  onSuccess
}: CreateOrderDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [amountRaw, setAmountRaw] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmountRaw('')
    setPaymentMethodId(paymentMethods[0]?.id ?? '')
    setComment('')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, paymentMethods])

  const amount = useMemo(() => parsePaymentAmount(amountRaw), [amountRaw])
  const preview = useMemo(() => {
    if (amount === null) return null
    return previewStatus(amount, totalGross)
  }, [amount, totalGross])

  const amountChips = useMemo(() => {
    const gross = roundQuoteMoney(totalGross)
    if (gross <= 0) {
      return [{ label: '0 Ft', value: 0 }]
    }
    const chips: { label: string; value: number }[] = [
      { label: '0 Ft', value: 0 },
      { label: '30%', value: roundQuoteMoney(gross * 0.3) },
      { label: '50%', value: roundQuoteMoney(gross * 0.5) },
      { label: 'Teljes', value: gross }
    ]
    const seen = new Set<number>()
    return chips.filter((c) => {
      if (c.value < 0 || c.value > gross) return false
      if (seen.has(c.value)) return false
      seen.add(c.value)
      return true
    })
  }, [totalGross])

  function applyAmountChip(value: number) {
    setAmountRaw(value <= 0 ? '0' : formatPaymentAmountInput(value))
    setError(null)
  }

  async function handleConfirm() {
    if (amount === null) {
      setError('Érvényes összeget adj meg (0 vagy pozitív).')
      return
    }
    if (amount > totalGross + PAYMENT_TOLERANCE_GROSS) {
      setError(
        `A befizetett összeg nem lehet nagyobb, mint a végösszeg (${formatQuotePrice(totalGross, currency)}).`
      )
      return
    }
    if (amount > 0 && !paymentMethodId) {
      setError(
        paymentMethods.length === 0
          ? 'Nincs aktív fizetési mód. Előbb vedd fel a törzsben.'
          : 'Válassz fizetési módot.'
      )
      return
    }

    setError(null)
    setLoading(true)
    try {
      const result = await convertQuoteToOrder(quoteId, {
        amount,
        paymentMethodId: amount > 0 ? paymentMethodId : null,
        comment
      })
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(`Megrendelés létrehozva: ${result.orderNumber}`)
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-[560px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Megrendelés létrehozása</DialogTitle>
          <DialogDescription>
            Az árajánlatból megrendelés készül. Az előleg opcionális (0 Ft = nincs
            előleg).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-subtle/50 p-3">
            <p className="text-body text-ink-secondary">
              Árajánlat:{' '}
              <span className="font-medium text-ink">{quoteNumber}</span>
            </p>
            <p className="mt-1 text-body font-semibold tabular-nums text-ink">
              Végösszeg: {formatQuotePrice(totalGross, currency)}
            </p>
          </div>

          <FormField
            label="Befizetett összeg"
            htmlFor="create-order-amount"
            required
            hint="0 Ft = nincs előleg. Gyorsválasztó: 30% / 50% / teljes."
            error={error && amount === null ? error : undefined}
          >
            <div className="relative">
              <Input
                id="create-order-amount"
                inputMode="decimal"
                value={amountRaw}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*[.,]?\d{0,2}$/.test(v)) setAmountRaw(v)
                }}
                placeholder="0"
                disabled={loading}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-secondary">
                Ft
              </span>
            </div>
            {amountChips.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {amountChips.map((chip) => {
                  const current = amount ?? 0
                  const active =
                    amountRaw === ''
                      ? chip.value === 0
                      : Math.abs(current - chip.value) <
                        PAYMENT_TOLERANCE_GROSS
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={loading}
                      onClick={() => applyAmountChip(chip.value)}
                      className={cn(
                        'rounded-md border border-border px-2 py-1 text-hint font-medium text-ink-secondary',
                        'hover:bg-subtle hover:text-ink',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        active && 'border-ink bg-subtle text-ink'
                      )}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </FormField>

          {(amount ?? 0) > 0 ? (
            <FormField
              label="Fizetési mód"
              htmlFor="create-order-method"
              required
            >
              {paymentMethods.length === 0 ? (
                <p className="rounded-md border border-warning/30 bg-warning-soft p-2 text-body text-warning-ink">
                  Nincs aktív fizetési mód.{' '}
                  <Link
                    href="/torzsadatok/rendszer/fizetesi-modok"
                    className="font-medium underline"
                  >
                    Vedd fel a törzsben
                  </Link>
                  .
                </p>
              ) : (
                <MenuSelect
                  id="create-order-method"
                  value={paymentMethodId}
                  disabled={loading}
                  allowEmpty={false}
                  portal={false}
                  placeholder="Válassz fizetési módot…"
                  options={paymentMethods.map((m) => ({
                    value: m.id,
                    label: m.name
                  }))}
                  onChange={setPaymentMethodId}
                />
              )}
            </FormField>
          ) : null}

          <FormField
            label="Megjegyzés"
            htmlFor="create-order-comment"
            optionalLabel
          >
            <Textarea
              id="create-order-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Opcionális megjegyzés a befizetéshez…"
              disabled={loading}
            />
          </FormField>

          {preview ? (
            <div
              className="rounded-md border border-border bg-subtle/40 px-3 py-2 text-body text-ink"
              role="status"
            >
              <p>
                Fizetési állapot:{' '}
                <strong>{PAYMENT_STATUS_LABEL[preview.status]}</strong>
              </p>
              {preview.remaining > 0 ? (
                <p className="mt-0.5 text-ink-secondary">
                  Hátralék:{' '}
                  <strong className="tabular-nums text-ink">
                    {formatQuotePrice(preview.remaining, currency)}
                  </strong>
                </p>
              ) : null}
            </div>
          ) : null}

          {error && amount !== null ? (
            <p className="text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={loading}
            onClick={() => void handleConfirm()}
          >
            Megrendelés létrehozása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
