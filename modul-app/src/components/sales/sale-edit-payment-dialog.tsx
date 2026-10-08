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
import { updateSalePaymentAction } from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import { salePaymentDue } from '@/lib/sales/payment-edit'
import type { SaleDetail, SalePaymentRow } from '@/lib/sales/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: SaleDetail
  payment: SalePaymentRow | null
  paymentMethods: PaymentMethodOption[]
}

export function SaleEditPaymentDialog({
  open,
  onOpenChange,
  detail,
  payment,
  paymentMethods
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const due = salePaymentDue(detail)

  const maxAmount = useMemo(() => {
    if (!payment) return due
    const others = detail.payments
      .filter((p) => p.id !== payment.id)
      .reduce(
        (s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount),
        0
      )
    return Math.max(1, due - others)
  }, [detail.payments, payment, due])

  const defaultMethod = payment?.payment_method_id || paymentMethods[0]?.id || ''
  const [paymentMethodId, setPaymentMethodId] = useState(defaultMethod)
  const [amount, setAmount] = useState(payment?.amount ?? 0)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open || !payment) return
    setPaymentMethodId(
      payment.payment_method_id || paymentMethods[0]?.id || ''
    )
    setAmount(payment.amount)
    setNote('')
  }, [open, payment, paymentMethods])

  const options = useMemo(
    () => paymentMethods.map((p) => ({ value: p.id, label: p.name })),
    [paymentMethods]
  )

  function handleSave() {
    if (!payment) return
    const amt = Math.round(amount)
    if (!(amt > 0)) {
      toast.error('Adj meg pozitív összeget.')
      return
    }
    if (amt > maxAmount + 1) {
      toast.error(`Max. ${formatMoneyFt(maxAmount)} Ft.`)
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
      const result = await updateSalePaymentAction({
        paymentId: payment.id,
        paymentMethodId,
        amount: amt,
        note: trimmed
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Fizetés korrigálva.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Fizetés korrekciója</DialogTitle>
          <DialogDescription>
            {detail.sale_number} · max{' '}
            <span className="font-medium tabular-nums text-ink">
              {formatMoneyFt(maxAmount)} Ft
            </span>
            . A régi sor érvénytelenítve lesz, új sor + naplóbejegyzés készül.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <FormField label="Fizetési mód" htmlFor="edit-pay-method" required>
            <MenuSelect
              id="edit-pay-method"
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              allowEmpty={false}
              portal={false}
              options={options}
            />
          </FormField>
          <FormField label="Összeg (Ft)" htmlFor="edit-pay-amt" required>
            <Input
              id="edit-pay-amt"
              type="number"
              min={1}
              max={maxAmount}
              className="tabular-nums"
              value={amount}
              onChange={(e) => {
                const n = Number(e.target.value)
                setAmount(Number.isFinite(n) ? n : 0)
              }}
            />
          </FormField>
          <FormField label="Indok" htmlFor="edit-pay-note" required>
            <Textarea
              id="edit-pay-note"
              rows={3}
              maxLength={500}
              placeholder="Pl. elütés javítása"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
