'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { updateQuotePaymentAction } from '@/lib/quotes/actions'
import { quotePaymentDue } from '@/lib/quotes/payment-edit'
import { PAYMENT_TOLERANCE_GROSS } from '@/lib/quotes/payment-labels'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { QuoteDetail, QuotePaymentRow } from '@/lib/quotes/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: QuoteDetail
  payment: QuotePaymentRow | null
  paymentMethods: PaymentMethodOption[]
}

export function QuoteEditPaymentDialog({
  open,
  onOpenChange,
  detail,
  payment,
  paymentMethods
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const due = quotePaymentDue(detail)

  const maxAmount = useMemo(() => {
    if (!payment) return due
    const others = detail.payments
      .filter((p) => p.id !== payment.id)
      .reduce((s, p) => s + p.amount, 0)
    return Math.max(0.01, Math.round((due - others) * 100) / 100)
  }, [detail.payments, payment, due])

  const defaultMethod = payment?.payment_method_id || paymentMethods[0]?.id || ''
  const [paymentMethodId, setPaymentMethodId] = useState(defaultMethod)
  const [amountRaw, setAmountRaw] = useState(
    payment ? String(payment.amount) : ''
  )
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open || !payment) return
    setPaymentMethodId(
      payment.payment_method_id || paymentMethods[0]?.id || ''
    )
    setAmountRaw(String(payment.amount))
    setNote('')
  }, [open, payment, paymentMethods])

  const options = useMemo(
    () => paymentMethods.map((p) => ({ value: p.id, label: p.name })),
    [paymentMethods]
  )

  function handleSave() {
    if (!payment) return
    const amt = Number(amountRaw.replace(',', '.'))
    if (!(amt > 0) || !Number.isFinite(amt)) {
      toast.error('Adj meg pozitív összeget.')
      return
    }
    if (amt > maxAmount + PAYMENT_TOLERANCE_GROSS) {
      toast.error(`Max. ${formatQuotePrice(maxAmount, detail.currency)}.`)
      return
    }
    if (!paymentMethodId) {
      toast.error('Válassz fizetési módot.')
      return
    }
    const trimmed = note.trim()
    if (!trimmed) {
      toast.error('A korrekció indoka kötelező.')
      return
    }
    startTransition(async () => {
      const result = await updateQuotePaymentAction({
        paymentId: payment.id,
        paymentMethodId,
        amount: Math.round(amt * 100) / 100,
        note: trimmed
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Befizetés korrigálva.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Befizetés korrekciója</DialogTitle>
          <DialogDescription>
            A régi sor érvénytelen lesz, új rögzítés készül. Indok kötelező.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Fizetési mód" htmlFor="edit-quote-pay-method" required>
            <MenuSelect
              id="edit-quote-pay-method"
              value={paymentMethodId}
              disabled={pending}
              allowEmpty={false}
              portal={false}
              options={options}
              onChange={setPaymentMethodId}
            />
          </FormField>

          <FormField label="Összeg" htmlFor="edit-quote-pay-amount" required>
            <div className="relative">
              <Input
                id="edit-quote-pay-amount"
                inputMode="decimal"
                value={amountRaw}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*[.,]?\d{0,2}$/.test(v)) setAmountRaw(v)
                }}
                disabled={pending}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-secondary">
                Ft
              </span>
            </div>
            <p className="mt-1 text-hint text-ink-secondary">
              Max. {formatQuotePrice(maxAmount, detail.currency)}
            </p>
          </FormField>

          <FormField label="Indok" htmlFor="edit-quote-pay-note" required>
            <Textarea
              id="edit-quote-pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={pending}
              maxLength={500}
              placeholder="Pl. téves összeg javítása…"
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" loading={pending} onClick={handleSave}>
            Korrekció mentése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
