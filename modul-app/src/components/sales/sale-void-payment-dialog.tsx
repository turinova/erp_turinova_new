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
import { voidSalePaymentAction } from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SalePaymentRow } from '@/lib/sales/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: SalePaymentRow | null
  saleNumber: string
}

export function SaleVoidPaymentDialog({
  open,
  onOpenChange,
  payment,
  saleNumber
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
      const result = await voidSalePaymentAction({
        paymentId: payment.id,
        note: trimmed
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Fizetés érvénytelenítve.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Fizetés érvénytelenítése</DialogTitle>
          <DialogDescription>
            {saleNumber}
            {payment
              ? ` · ${payment.payment_method_name} · ${formatMoneyFt(payment.amount)} Ft`
              : ''}
            . A sor megmarad a tevékenységnaplóban.
          </DialogDescription>
        </DialogHeader>

        <FormField label="Indok" htmlFor="void-pay-note" required>
          <Textarea
            id="void-pay-note"
            rows={3}
            maxLength={500}
            placeholder="Pl. elütés, rossz fizetési mód"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
