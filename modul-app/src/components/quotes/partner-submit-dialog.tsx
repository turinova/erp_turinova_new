'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { MenuSelect } from '@/components/ui/menu-select'
import { PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'
import {
  partnerBillingIncompleteMessage,
  type PartnerBillingForProformaResult
} from '@/lib/partner/auto-proforma-rules'
import { pickDefaultPaymentMethodId } from '@/lib/payment-methods/default'
import {
  isCardPaymentMethod,
  isTransferPaymentMethod
} from '@/lib/payment-methods/kinds'
import {
  listPartnerPaymentMethodsForSubmit,
  type PartnerSubmitPaymentMethod
} from '@/lib/quotes/partner-actions'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteNumber: string
  /** Visszatérés a Beállításokból (pl. /ajanlatok/{id}?submit=1). */
  returnPath: string
  loading?: boolean
  onConfirm: (paymentMethodId: string) => void
}

export function PartnerSubmitDialog({
  open,
  onOpenChange,
  quoteNumber,
  returnPath,
  loading = false,
  onConfirm
}: Props) {
  const partnerHref = usePartnerHref()
  const [methods, setMethods] = useState<PartnerSubmitPaymentMethod[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingMethods, setLoadingMethods] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [autoProforma, setAutoProforma] = useState(false)
  const [teyaOnlineReady, setTeyaOnlineReady] = useState(false)
  const [billingReady, setBillingReady] = useState<PartnerBillingForProformaResult>(
    { ok: true }
  )

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
        setAutoProforma(result.autoProformaOnTransfer)
        setBillingReady(result.billingReady)
        setTeyaOnlineReady(result.teyaOnlineReady)
        setPaymentMethodId(pickDefaultPaymentMethodId(result.methods))
      })
      .finally(() => setLoadingMethods(false))
  }, [open])

  const selected = methods.find((m) => m.id === paymentMethodId) ?? null
  const selectedIsCard = Boolean(selected && isCardPaymentMethod(selected))
  const selectedIsTransfer = Boolean(
    selected && isTransferPaymentMethod(selected)
  )
  const needsBilling =
    Boolean(selected) &&
    !billingReady.ok &&
    ((autoProforma && selectedIsTransfer) || selectedIsCard)
  const cardNotReady = selectedIsCard && !teyaOnlineReady
  const canSubmit =
    Boolean(paymentMethodId) &&
    methods.length > 0 &&
    !loadingMethods &&
    !needsBilling &&
    !cardNotReady

  const settingsHref = (() => {
    const base = partnerHref(PARTNER_SETTINGS_PATH)
    const q = new URLSearchParams()
    q.set('return', returnPath)
    return `${base}?${q.toString()}#szamlazas`
  })()

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
          {needsBilling ? (
            <div
              className="space-y-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2"
              role="alert"
            >
              <p className="text-hint text-warning-ink">
                {partnerBillingIncompleteMessage(billingReady)}
              </p>
              <Link
                href={settingsHref}
                className={buttonVariants({ variant: 'primary', size: 'sm' })}
                onClick={() => onOpenChange(false)}
              >
                Számlázási adatok kitöltése
              </Link>
            </div>
          ) : cardNotReady ? (
            <p
              className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-hint text-warning-ink"
              role="alert"
            >
              A cégnél még nincs beállítva az online kártyás fizetés. Válassz
              átutalást, vagy jelezd nekik.
            </p>
          ) : selectedIsCard ? (
            <p className="text-hint text-ink-secondary" role="note">
              Beküldés után a biztonságos Teya fizetőfelületre viszünk — ott
              fizethetsz bankkártyával.
            </p>
          ) : selected && autoProforma && selectedIsTransfer ? (
            <p className="text-hint text-ink-secondary" role="note">
              Beküldés után e-mailben megkapod a díjbekérőt, abban látod az
              utalás adatait.
            </p>
          ) : selected && !autoProforma && selectedIsTransfer ? (
            <p className="text-hint text-ink-secondary" role="note">
              Átutalásos beküldés — a díjbekérőt a cég intézi (nem megy ki
              automatikusan).
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
              if (!paymentMethodId || needsBilling) return
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
