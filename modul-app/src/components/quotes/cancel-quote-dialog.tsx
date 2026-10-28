'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { cancelQuoteAction } from '@/lib/quotes/actions'
import {
  needsStrongCancelConfirm,
  QUOTE_CANCEL_REASON_LABEL,
  QUOTE_CANCEL_REASONS,
  type QuoteCancelReason
} from '@/lib/quotes/cancel'
import type { QuoteStatus } from '@/lib/quotes/queries'

type CancelQuoteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  orderNumber: string
  customerName: string
  totalGross: number
  currency: string
  status: QuoteStatus
  totalPaid: number
  hasActiveProforma: boolean
  productionHint: string | null
  smsAlreadySent: boolean
  onSuccess: () => void
}

const REASON_OPTIONS = QUOTE_CANCEL_REASONS.map((value) => ({
  value,
  label: QUOTE_CANCEL_REASON_LABEL[value]
}))

export function CancelQuoteDialog({
  open,
  onOpenChange,
  quoteId,
  orderNumber,
  customerName,
  totalGross,
  currency,
  status,
  totalPaid,
  hasActiveProforma,
  productionHint,
  smsAlreadySent,
  onSuccess
}: CancelQuoteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState<QuoteCancelReason>('customer')
  const [note, setNote] = useState('')
  const [confirmNumber, setConfirmNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const strong = needsStrongCancelConfirm(status)
  const confirmOk = !strong || confirmNumber.trim() === orderNumber

  const statusBanner = useMemo(() => {
    if (status === 'in_production') {
      return productionHint
        ? `Gyártásban van (${productionHint}) — a műhelynek is szólni kell.`
        : 'Gyártásban van — a műhelynek is szólni kell.'
    }
    if (status === 'ready') {
      return smsAlreadySent
        ? 'Már készre van jelölve, és SMS mehetett az ügyfélnek.'
        : 'Már készre van jelölve.'
    }
    return 'A gyártás még nem indult.'
  }, [status, productionHint, smsAlreadySent])

  useEffect(() => {
    if (!open) return
    setReason('customer')
    setNote('')
    setConfirmNumber('')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  async function handleConfirm() {
    if (!confirmOk) {
      setError(`Írd be pontosan: ${orderNumber}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await cancelQuoteAction({
        quoteId,
        reason,
        note
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(`Megrendelés ${result.orderNumber} lemondva.`)
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Megrendelés lemondása</DialogTitle>
          <DialogDescription>
            Megrendelés {orderNumber} · {customerName} ·{' '}
            {formatQuotePrice(totalGross, currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p
            className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink"
            role="status"
          >
            {statusBanner}
          </p>

          {totalPaid > 0 ? (
            <p className="text-body text-ink-secondary" role="status">
              Van rögzített befizetés (
              {formatQuotePrice(totalPaid, currency)}). A lemondás nem
              törli automatikusan — visszatérítést a Befizetéseknél intézd.
            </p>
          ) : null}

          {hasActiveProforma ? (
            <p className="text-body text-ink-secondary" role="status">
              Van aktív díjbekérő / előleg. Szükség esetén sztornózd a
              Bizonylatoknál.
            </p>
          ) : null}

          <FormField label="Ok" htmlFor="cancel-quote-reason" required>
            <MenuSelect
              id="cancel-quote-reason"
              value={reason}
              options={REASON_OPTIONS}
              allowEmpty={false}
              disabled={loading}
              onChange={(v) => setReason(v as QuoteCancelReason)}
            />
          </FormField>

          <FormField
            label="Megjegyzés"
            htmlFor="cancel-quote-note"
            required={reason === 'other'}
            hint={
              reason === 'other' ? 'Egyéb oknál legalább 3 karakter.' : undefined
            }
          >
            <Textarea
              id="cancel-quote-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </FormField>

          {strong ? (
            <FormField
              label={`Írd be: ${orderNumber}`}
              htmlFor="cancel-quote-confirm"
              required
            >
              <Input
                id="cancel-quote-confirm"
                value={confirmNumber}
                onChange={(e) => setConfirmNumber(e.target.value)}
                autoComplete="off"
                disabled={loading}
                placeholder={orderNumber}
              />
            </FormField>
          ) : null}

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
            variant="danger"
            disabled={loading || !confirmOk}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            Megrendelés lemondása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
