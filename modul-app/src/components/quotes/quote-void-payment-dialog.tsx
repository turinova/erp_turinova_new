'use client'

import { useEffect, useState, useTransition } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { voidQuotePaymentAction } from '@/lib/quotes/actions'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { QuotePaymentRow } from '@/lib/quotes/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: QuotePaymentRow | null
  orderNumber: string
  currency: string
}

export function QuoteVoidPaymentDialog({
  open,
  onOpenChange,
  payment,
  orderNumber,
  currency
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNote('')
  }, [open, payment?.id])

  function handleConfirm() {
    if (!payment) return
    const trimmed = note.trim()
    if (!trimmed) {
      toast.error('Az érvénytelenítés indoka kötelező.')
      return
    }
    startTransition(async () => {
      const result = await voidQuotePaymentAction({
        paymentId: payment.id,
        note: trimmed
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Befizetés érvénytelenítve.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Befizetés érvénytelenítése</DialogTitle>
          <DialogDescription>
            {orderNumber}
            {payment
              ? ` · ${payment.payment_method_name} · ${formatQuotePrice(payment.amount, currency)}`
              : ''}
            . A sor megmarad a tevékenységnaplóban.
          </DialogDescription>
        </DialogHeader>

        <FormField label="Indok" htmlFor="void-quote-pay-note" required>
          <Textarea
            id="void-quote-pay-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Pl. téves összeg, rossz mód…"
            disabled={pending}
            maxLength={500}
          />
        </FormField>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={pending}
            onClick={handleConfirm}
          >
            Érvénytelenítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
