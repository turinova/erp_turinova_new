'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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
import { MenuSelect } from '@/components/ui/menu-select'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { finishQuotesHandoverBulk } from '@/lib/scanner/actions'

export type ScannerHandoverItem = {
  id: string
  orderNumber: string
  remaining: number
}

type ScannerHandoverDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ScannerHandoverItem[]
  currency: string
  paymentMethods: PaymentMethodOption[]
  onSuccess: (
    successIds: string[],
    summary?: { tone: 'success' | 'warning'; message: string }
  ) => void
}

export function ScannerHandoverDialog({
  open,
  onOpenChange,
  items,
  currency,
  paymentMethods,
  onSuccess
}: ScannerHandoverDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingSettle, setLoadingSettle] = useState(false)
  const [loadingSkip, setLoadingSkip] = useState(false)

  const unpaid = items.filter((i) => i.remaining > 0)
  const totalRemaining = unpaid.reduce((sum, i) => sum + i.remaining, 0)
  const hasRemaining = totalRemaining > 0
  const loading = loadingSettle || loadingSkip
  const count = items.length

  useEffect(() => {
    if (!open) return
    setPaymentMethodId(paymentMethods[0]?.id ?? '')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, paymentMethods])

  async function runHandover(settleRemaining: boolean) {
    setError(null)
    if (settleRemaining) {
      if (!paymentMethodId) {
        setError(
          paymentMethods.length === 0
            ? 'Nincs aktív fizetési mód. Vedd fel a törzsben.'
            : 'Válassz fizetési módot.'
        )
        return
      }
      setLoadingSettle(true)
    } else {
      setLoadingSkip(true)
    }

    try {
      const result = await finishQuotesHandoverBulk({
        quoteIds: items.map((i) => i.id),
        settleRemaining,
        paymentMethodId: settleRemaining ? paymentMethodId : undefined
      })

      const successIds = result.results.filter((r) => r.ok).map((r) => r.id)
      const paidCount = result.results.filter((r) => r.paymentCreated).length

      if (result.successCount === 0) {
        const firstFail = result.results.find((r) => !r.ok)
        setError(firstFail?.message ?? 'Nem sikerült az átadás.')
        return
      }

      const summary =
        result.failCount > 0
          ? {
              tone: 'warning' as const,
              message: `${result.successCount} / ${result.results.length} átadva. ${result.failCount} kihagyva.`
            }
          : {
              tone: 'success' as const,
              message:
                paidCount > 0
                  ? `${result.successCount} rendelés átadva, hátralék rögzítve.`
                  : `${result.successCount} rendelés átadva.`
            }

      onOpenChange(false)
      onSuccess(successIds, summary)
    } finally {
      setLoadingSettle(false)
      setLoadingSkip(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[480px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Átadás a megrendelőnek</DialogTitle>
          <DialogDescription>
            {count === 1
              ? `${items[0]?.orderNumber ?? ''} — a státusz Lezárva lesz.`
              : `${count} kijelölt rendelés — a státusz Lezárva lesz.`}
          </DialogDescription>
        </DialogHeader>

        {hasRemaining ? (
          <div className="space-y-3">
            <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink">
              Összes hátralék ({unpaid.length} rendelés):{' '}
              <span className="font-semibold tabular-nums">
                {formatQuotePrice(totalRemaining, currency)}
              </span>
            </p>
            <FormField
              label="Fizetési mód (minden hátralékhoz)"
              htmlFor="scanner-handover-payment-method"
            >
              <MenuSelect
                id="scanner-handover-payment-method"
                value={paymentMethodId}
                disabled={loading || paymentMethods.length === 0}
                allowEmpty={false}
                placeholder={
                  paymentMethods.length === 0
                    ? 'Nincs aktív mód'
                    : 'Válassz fizetési módot…'
                }
                options={paymentMethods.map((m) => ({
                  value: m.id,
                  label: m.name
                }))}
                onChange={setPaymentMethodId}
              />
            </FormField>
            {paymentMethods.length === 0 ? (
              <p className="text-hint text-ink-secondary">
                <Link
                  href="/torzsadatok/rendszer/fizetesi-modok"
                  className="underline"
                >
                  Fizetési módok
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-ink-secondary">
            {count === 1
              ? 'A megrendelés ki van fizetve. Átadod a megrendelőnek?'
              : 'A kijelölt rendelések ki vannak fizetve. Átadod őket?'}
          </p>
        )}

        {error ? (
          <p className="text-body text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          {hasRemaining ? (
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              loading={loadingSkip}
              onClick={() => void runHandover(false)}
            >
              Átadás fizetés nélkül
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={loading}
            loading={hasRemaining ? loadingSettle : loadingSkip}
            onClick={() => void runHandover(hasRemaining)}
          >
            {hasRemaining ? 'Hátralék rögzítése és átadás' : 'Átadás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
