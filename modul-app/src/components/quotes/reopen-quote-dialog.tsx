'use client'

import { useEffect, useRef, useState } from 'react'
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
import { reopenFinishedQuoteAction } from '@/lib/quotes/actions'
import {
  orderNumbersMatch,
  QUOTE_REOPEN_REASON_LABEL,
  QUOTE_REOPEN_REASONS,
  type QuoteReopenReason
} from '@/lib/quotes/reopen'

type ReopenQuoteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  orderNumber: string
  customerName: string
  totalGross: number
  currency: string
  totalPaid: number
  onSuccess: () => void
}

const REASON_OPTIONS = QUOTE_REOPEN_REASONS.map((value) => ({
  value,
  label: QUOTE_REOPEN_REASON_LABEL[value]
}))

export function ReopenQuoteDialog({
  open,
  onOpenChange,
  quoteId,
  orderNumber,
  customerName,
  totalGross,
  currency,
  totalPaid,
  onSuccess
}: ReopenQuoteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState<QuoteReopenReason>('accidental')
  const [note, setNote] = useState('')
  const [confirmNumber, setConfirmNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const confirmOk = orderNumbersMatch(confirmNumber, orderNumber)

  useEffect(() => {
    if (!open) return
    setReason('accidental')
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
      const result = await reopenFinishedQuoteAction({
        quoteId,
        reason,
        note,
        orderNumberConfirm: confirmNumber
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(
        `Megrendelés ${result.orderNumber} újra kész (átadás visszavonva).`
      )
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
          <DialogTitle>Megrendelés újranyitása</DialogTitle>
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
            Visszaáll <strong>Kész</strong> státuszba. Az átadás visszavonódik.
            Befizetések megmaradnak.
          </p>

          {totalPaid > 0 ? (
            <p className="text-body text-ink-secondary" role="status">
              Van rögzített befizetés (
              {formatQuotePrice(totalPaid, currency)}). Az újranyitás nem
              törli — visszatérítést a Befizetéseknél intézd.
            </p>
          ) : null}

          <FormField label="Ok" htmlFor="reopen-quote-reason" required>
            <MenuSelect
              id="reopen-quote-reason"
              value={reason}
              options={REASON_OPTIONS}
              allowEmpty={false}
              disabled={loading}
              onChange={(v) => setReason(v as QuoteReopenReason)}
            />
          </FormField>

          <FormField
            label="Megjegyzés"
            htmlFor="reopen-quote-note"
            required={reason === 'other'}
            hint={
              reason === 'other' ? 'Egyéb oknál legalább 3 karakter.' : undefined
            }
          >
            <Textarea
              id="reopen-quote-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </FormField>

          <FormField
            label={`Írd be: ${orderNumber}`}
            htmlFor="reopen-quote-confirm"
            required
          >
            <Input
              id="reopen-quote-confirm"
              value={confirmNumber}
              onChange={(e) => setConfirmNumber(e.target.value)}
              autoComplete="off"
              disabled={loading}
              placeholder={orderNumber}
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
            variant="danger"
            disabled={loading || !confirmOk}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            Újranyitás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
