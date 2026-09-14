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
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { convertQuoteToOrder } from '@/lib/quotes/actions'
import {
  parsePaymentAmount,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus
} from '@/lib/quotes/payment-labels'

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
  const remaining = Math.round((totalGross - amount) * 100) / 100
  if (amount <= 0) return { status: 'not_paid', remaining: totalGross }
  if (amount >= totalGross - 1) return { status: 'paid', remaining: 0 }
  return { status: 'partial', remaining: Math.max(0, remaining) }
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

  async function handleConfirm() {
    if (amount === null) {
      setError('Érvényes összeget adj meg (0 vagy pozitív).')
      return
    }
    if (amount > totalGross + 1) {
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
            hint="Adj meg 0-t, ha nincs előleg."
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
                <Select
                  id="create-order-method"
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  disabled={loading}
                >
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
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
