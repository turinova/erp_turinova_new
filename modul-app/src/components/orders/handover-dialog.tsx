'use client'

import { useEffect, useRef, useState } from 'react'
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
import { MenuSelect } from '@/components/ui/menu-select'
import { prepareHandoverSlipPrint } from '@/lib/handover-slip/actions'
import { printHandoverSlip } from '@/lib/handover-slip/print'
import { requestUsbPrinter } from '@/lib/handover-slip/webusb'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { finishQuoteHandover } from '@/lib/quotes/production-actions'

type HandoverDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  orderNumber: string
  customerName: string
  remaining: number
  currency: string
  paymentMethods: PaymentMethodOption[]
  onSuccess: () => void
}

export function HandoverDialog({
  open,
  onOpenChange,
  quoteId,
  orderNumber,
  customerName,
  remaining,
  currency,
  paymentMethods,
  onSuccess
}: HandoverDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingSettle, setLoadingSettle] = useState(false)
  const [loadingSkip, setLoadingSkip] = useState(false)

  const hasRemaining = remaining > 0
  const loading = loadingSettle || loadingSkip

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

    // WebUSB user gesture — Átadás gomb clickjén, a szerver hívás előtt
    const usbDevice = await requestUsbPrinter()

    try {
      const result = await finishQuoteHandover({
        quoteId,
        settleRemaining,
        paymentMethodId: settleRemaining ? paymentMethodId : undefined
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(
        result.paymentCreated
          ? `${orderNumber} átadva, hátralék rögzítve.`
          : `${orderNumber} átadva a megrendelőnek.`
      )

      try {
        const slip = await prepareHandoverSlipPrint(quoteId)
        if (slip.ok && slip.print) {
          const printed = await printHandoverSlip({
            data: slip.data,
            settings: slip.settings,
            copyTypes: slip.copyTypes,
            usbDevice
          })
          if (printed.method === 'browser') {
            toast.message('Átvételi blokk: böngészős nyomtatás.')
          }
        } else if (!slip.ok) {
          toast.warning(slip.message)
        }
      } catch (printErr) {
        console.warn('handover slip print', printErr)
        toast.warning(
          'Átadás kész, de az átvételi blokk nyomtatása nem sikerült.'
        )
      }

      onOpenChange(false)
      onSuccess()
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
            {orderNumber} · {customerName}. A státusz Lezárva lesz.
          </DialogDescription>
        </DialogHeader>

        {hasRemaining ? (
          <div className="space-y-3">
            <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink">
              Hátralék:{' '}
              <span className="font-semibold tabular-nums">
                {formatQuotePrice(remaining, currency)}
              </span>
            </p>
            <FormField label="Fizetési mód" htmlFor="handover-payment-method">
              <MenuSelect
                id="handover-payment-method"
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
            A megrendelés ki van fizetve. Átadod a megrendelőnek?
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
