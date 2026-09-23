'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
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
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { recordSalePaymentAction } from '@/lib/sales/actions'
import { isDeferredPaymentMethodName } from '@/lib/sales/payment-kind'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleDetail } from '@/lib/sales/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: SaleDetail
  paymentMethods: PaymentMethodOption[]
  /** Van aktív díjbekérő → alapból utalás */
  hasProforma?: boolean
  /** Teljes kiegyenlítés után: fulfill dialógus vagy végszámla */
  afterPayNavigate?: 'fulfill' | 'final' | null
}

function pickDefaultPaymentMethodId(
  methods: PaymentMethodOption[],
  preferTransfer: boolean
): string {
  if (methods.length === 0) return ''
  if (preferTransfer) {
    const transfer = methods.find((m) => isDeferredPaymentMethodName(m.name))
    if (transfer) return transfer.id
  }
  return methods[0]?.id ?? ''
}

export function SaleRecordPaymentDialog({
  open,
  onOpenChange,
  detail,
  paymentMethods,
  hasProforma = false,
  afterPayNavigate = null
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const due = detail.total_gross + detail.cash_rounding_amount
  const paidSum = detail.payments
    .filter((p) => p.kind === 'payment')
    .reduce((s, p) => s + p.amount, 0)
  const refundSum = detail.payments
    .filter((p) => p.kind === 'refund')
    .reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, due - (paidSum - refundSum))

  /** Díjbekérő vagy fizetetlen eladás → utalás az alap. */
  const preferTransfer =
    hasProforma ||
    detail.payment_status === 'unpaid' ||
    detail.payment_status === 'partial'

  const defaultMethod = useMemo(
    () => pickDefaultPaymentMethodId(paymentMethods, preferTransfer),
    [paymentMethods, preferTransfer]
  )

  const [paymentMethodId, setPaymentMethodId] = useState(defaultMethod)
  const [amount, setAmount] = useState(remaining)

  useEffect(() => {
    if (!open) return
    setPaymentMethodId(defaultMethod)
    setAmount(remaining)
  }, [open, defaultMethod, remaining])

  const options = useMemo(
    () => paymentMethods.map((p) => ({ value: p.id, label: p.name })),
    [paymentMethods]
  )

  const selectedIsTransfer = isDeferredPaymentMethodName(
    paymentMethods.find((m) => m.id === paymentMethodId)?.name
  )

  function handleSubmit() {
    startTransition(async () => {
      const amt = Math.round(amount)
      if (!(amt > 0)) {
        toast.error('Adj meg pozitív összeget.')
        return
      }
      if (!paymentMethodId) {
        toast.error('Válassz fizetési módot.')
        return
      }
      const result = await recordSalePaymentAction({
        salesOrderId: detail.id,
        paymentMethodId,
        amount: amt
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Fizetés rögzítve.')
      onOpenChange(false)
      const fullyPaid = amt >= remaining - 1
      if (fullyPaid && afterPayNavigate === 'fulfill') {
        router.push(`/ertekesitesek/${detail.id}?fulfill=1`)
        router.refresh()
      } else if (fullyPaid && afterPayNavigate === 'final') {
        router.push(`/ertekesitesek/${detail.id}?issue=normal`)
        router.refresh()
      } else {
        router.refresh()
      }
    })
  }

  const hint =
    afterPayNavigate === 'fulfill'
      ? ' — teljes kiegyenlítés után áruátadás következik.'
      : afterPayNavigate === 'final'
        ? ' — teljes kiegyenlítés után végszámla következik.'
        : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Fizetés rögzítése</DialogTitle>
          <DialogDescription>
            {detail.sale_number} · hátralék{' '}
            <span className="font-medium tabular-nums text-ink">
              {formatMoneyFt(remaining)} Ft
            </span>
            {hint}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {hasProforma ? (
            <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
              Van kiállított díjbekérő
              {selectedIsTransfer
                ? ' — fizetési mód: utalás (alapértelmezett).'
                : ' — ha az utalás megérkezett, válaszd az utalást.'}
            </p>
          ) : null}
          <FormField label="Fizetési mód" htmlFor="rec-pay-method" required>
            <MenuSelect
              id="rec-pay-method"
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              allowEmpty={false}
              options={options}
            />
          </FormField>
          <FormField label="Összeg (Ft)" htmlFor="rec-pay-amt" required>
            <Input
              id="rec-pay-amt"
              type="number"
              min={1}
              max={remaining}
              className="tabular-nums"
              value={amount}
              onChange={(e) => {
                const n = Number(e.target.value)
                setAmount(Number.isFinite(n) ? n : 0)
              }}
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
          <Button
            type="button"
            loading={pending}
            disabled={remaining <= 0 || paymentMethods.length === 0}
            onClick={handleSubmit}
          >
            Fizetés rögzítése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
