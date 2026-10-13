'use client'

import { useEffect, useState } from 'react'

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
import {
  listPartnerPaymentMethodsForSubmit,
  type PartnerSubmitPaymentMethod
} from '@/lib/quotes/partner-actions'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteNumber: string
  loading?: boolean
  onConfirm: (paymentMethodId: string) => void
}

export function PartnerSubmitDialog({
  open,
  onOpenChange,
  quoteNumber,
  loading = false,
  onConfirm
}: Props) {
  const [methods, setMethods] = useState<PartnerSubmitPaymentMethod[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingMethods, setLoadingMethods] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState('')

  useEffect(() => {
    if (!open) return
    setPaymentMethodId('')
    setLoadError(null)
    setLoadingMethods(true)
    void listPartnerPaymentMethodsForSubmit()
      .then((result) => {
        if (!result.ok) {
          setMethods([])
          setLoadError(result.message)
          return
        }
        setMethods(result.methods)
        if (result.methods.length === 1) {
          setPaymentMethodId(result.methods[0].id)
        }
      })
      .finally(() => setLoadingMethods(false))
  }, [open])

  const selected = methods.find((m) => m.id === paymentMethodId) ?? null
  const canSubmit =
    Boolean(paymentMethodId) && methods.length > 0 && !loadingMethods

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Ajánlat beküldése</DialogTitle>
          <DialogDescription>
            Beküldöd a(z) {quoteNumber} ajánlatot a cégnek? Utána már nem
            szerkesztheted. Válaszd ki, hogyan szeretnél fizetni.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="partner-submit-pay-method"
            className="block text-hint text-ink-secondary"
          >
            Fizetési mód
          </label>
          {loadingMethods ? (
            <p className="text-body text-ink-secondary">Betöltés…</p>
          ) : loadError ? (
            <p className="text-body text-danger-ink" role="alert">
              {loadError}
            </p>
          ) : methods.length === 0 ? (
            <p className="text-body text-danger-ink" role="alert">
              A cégnek nincs aktív fizetési módja. Jelezd nekik, majd próbáld
              újra.
            </p>
          ) : (
            <MenuSelect
              id="partner-submit-pay-method"
              value={paymentMethodId}
              allowEmpty
              emptyLabel="Válassz…"
              disabled={loading}
              portal={false}
              options={methods.map((m) => ({
                value: m.id,
                label: m.name
              }))}
              onChange={setPaymentMethodId}
            />
          )}
          {selected?.comment ? (
            <p
              className={cn(
                'rounded-md border border-border bg-subtle px-3 py-2 text-hint text-ink'
              )}
              role="note"
            >
              {selected.comment}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={!canSubmit || loading}
            onClick={() => {
              if (!paymentMethodId) return
              onConfirm(paymentMethodId)
            }}
          >
            Beküldés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
