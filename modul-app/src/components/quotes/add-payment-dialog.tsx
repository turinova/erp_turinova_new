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
import { addQuotePayment } from '@/lib/quotes/actions'
import {
  PAYMENT_TOLERANCE_GROSS,
  parsePaymentAmount,
  quoteRemainingGross
} from '@/lib/quotes/payment-labels'

type AddPaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  orderNumber: string
  totalGross: number
  totalPaid: number
  currency: string
  paymentMethods: PaymentMethodOption[]
  onSuccess: () => void
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  quoteId,
  orderNumber,
  totalGross,
  totalPaid,
  currency,
  paymentMethods,
  onSuccess
}: AddPaymentDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [amountRaw, setAmountRaw] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const remaining = quoteRemainingGross(totalGross, totalPaid)

  useEffect(() => {
    if (!open) return
    setAmountRaw(remaining > 0 ? String(remaining) : '')
    setPaymentMethodId(paymentMethods[0]?.id ?? '')
    setComment('')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, paymentMethods, remaining])

  const amount = useMemo(() => parsePaymentAmount(amountRaw), [amountRaw])

  async function handleConfirm() {
    if (amount === null || amount <= 0) {
      setError('Adj meg pozitív összeget.')
      return
    }
    if (amount > remaining + PAYMENT_TOLERANCE_GROSS) {
      setError(
        `Az összeg nem lehet nagyobb, mint a hátralék (${formatQuotePrice(remaining, currency)}).`
      )
      return
    }
    if (!paymentMethodId) {
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
      const result = await addQuotePayment({
        quoteId,
        amount,
        paymentMethodId,
        comment
      })
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success('Befizetés rögzítve.')
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
          <DialogTitle>Befizetés rögzítése</DialogTitle>
          <DialogDescription>
            Új befizetés a(z) {orderNumber} megrendeléshez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-subtle/50 p-3 text-body">
            <p className="text-ink-secondary">
              Végösszeg:{' '}
              <strong className="tabular-nums text-ink">
                {formatQuotePrice(totalGross, currency)}
              </strong>
            </p>
            <p className="text-ink-secondary">
              Eddig fizetve:{' '}
              <strong className="tabular-nums text-ink">
                {formatQuotePrice(totalPaid, currency)}
              </strong>
            </p>
            <p className="mt-1 font-medium text-ink">
              Hátralék:{' '}
              <span className="tabular-nums">
                {formatQuotePrice(remaining, currency)}
              </span>
            </p>
          </div>

          <FormField label="Összeg" htmlFor="add-payment-amount" required>
            <div className="relative">
              <Input
                id="add-payment-amount"
                inputMode="decimal"
                value={amountRaw}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*[.,]?\d{0,2}$/.test(v)) setAmountRaw(v)
                }}
                disabled={loading}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-secondary">
                Ft
              </span>
            </div>
          </FormField>

          <FormField label="Fizetési mód" htmlFor="add-payment-method" required>
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
                id="add-payment-method"
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

          <FormField
            label="Megjegyzés"
            htmlFor="add-payment-comment"
            optionalLabel
          >
            <Textarea
              id="add-payment-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              disabled={loading}
            />
          </FormField>

          {error ? (
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
            disabled={loading || remaining <= 0}
            onClick={() => void handleConfirm()}
          >
            Befizetés rögzítése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
