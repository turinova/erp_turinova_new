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
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import { cancelSaleAction } from '@/lib/sales/actions'
import {
  SALE_CANCEL_REASON_LABEL,
  SALE_CANCEL_REASONS,
  type SaleCancelReason
} from '@/lib/sales/cancel'
import { formatMoneyFt } from '@/lib/sales/parse'

type CancelSaleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: string
  saleNumber: string
  customerName: string | null
  totalGross: number
  hasPayments: boolean
  linkedCso: boolean
  onSuccess: () => void
}

const REASON_OPTIONS = SALE_CANCEL_REASONS.map((value) => ({
  value,
  label: SALE_CANCEL_REASON_LABEL[value]
}))

export function CancelSaleDialog({
  open,
  onOpenChange,
  saleId,
  saleNumber,
  customerName,
  totalGross,
  hasPayments,
  linkedCso,
  onSuccess
}: CancelSaleDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState<SaleCancelReason>('test')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason('test')
    setNote('')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const result = await cancelSaleAction({
        saleId,
        reason,
        note
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(`Eladás ${result.saleNumber} lemondva.`)
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
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
          <DialogTitle>Eladás lemondása</DialogTitle>
          <DialogDescription>
            {saleNumber}
            {customerName ? ` · ${customerName}` : ' · Vendég'} ·{' '}
            {formatMoneyFt(totalGross)} Ft. A készlet nem változott (még nem
            volt átadás). Fizetés / számla nem törlődik automatikusan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hasPayments ? (
            <p
              className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2 text-body text-warning-ink"
              role="status"
            >
              Van rögzített fizetés — a lemondás után is megmarad a naplóban.
            </p>
          ) : null}
          {linkedCso ? (
            <p
              className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary"
              role="status"
            >
              Ügyfélrendeléshez kapcsolódik — a CSO státuszt külön ellenőrizd.
            </p>
          ) : null}

          <FormField label="Ok" htmlFor="sale-cancel-reason">
            <MenuSelect
              id="sale-cancel-reason"
              value={reason}
              options={REASON_OPTIONS}
              allowEmpty={false}
              onChange={(v) => setReason(v as SaleCancelReason)}
            />
          </FormField>

          <FormField
            label="Megjegyzés"
            htmlFor="sale-cancel-note"
            hint={
              reason === 'other'
                ? 'Egyéb oknál legalább 3 karakter.'
                : undefined
            }
          >
            <Textarea
              id="sale-cancel-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Opcionális…"
            />
          </FormField>

          {error ? (
            <p className="text-body text-danger" role="alert">
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
            disabled={loading}
            onClick={() => void handleConfirm()}
          >
            {loading ? 'Lemondás…' : 'Eladást lemond'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
