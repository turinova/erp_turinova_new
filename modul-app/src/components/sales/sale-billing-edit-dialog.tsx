'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  billingHasAny,
  DocumentBillingFields,
  EMPTY_DOCUMENT_BILLING,
  type DocumentBillingState
} from '@/components/sales/document-billing-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { updateSaleBillingAction } from '@/lib/sales/actions'
import type { SaleCustomerSnapshot, SaleDetail } from '@/lib/sales/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: SaleDetail
}

function billingFromSnapshot(c: SaleCustomerSnapshot): DocumentBillingState {
  if (
    !c.billing_name &&
    !c.billing_city &&
    !c.billing_street &&
    !c.billing_tax_number
  ) {
    return {
      ...EMPTY_DOCUMENT_BILLING,
      billingName: c.name || ''
    }
  }
  return {
    billingName: c.billing_name || c.name || '',
    billingCountry: c.billing_country || 'Magyarország',
    billingCity: c.billing_city || '',
    billingPostalCode: c.billing_postal_code || '',
    billingStreet: c.billing_street || '',
    billingHouseNumber: c.billing_house_number || '',
    billingTaxNumber: c.billing_tax_number || ''
  }
}

export function SaleBillingEditDialog({
  open,
  onOpenChange,
  detail
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [billing, setBilling] = useState<DocumentBillingState>(
    EMPTY_DOCUMENT_BILLING
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBilling(billingFromSnapshot(detail.customer))
    setError(null)
  }, [open, detail.customer])

  function handleSave() {
    if (!billing.billingName.trim()) {
      setError('A számlázási név kötelező.')
      return
    }
    if (!billingHasAny(billing)) {
      setError('Adj meg legalább nevet és címet.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateSaleBillingAction({
        salesOrderId: detail.id,
        billing: {
          billingName: billing.billingName.trim(),
          billingCountry: billing.billingCountry.trim() || 'Magyarország',
          billingCity: billing.billingCity.trim() || null,
          billingPostalCode: billing.billingPostalCode.trim() || null,
          billingStreet: billing.billingStreet.trim() || null,
          billingHouseNumber: billing.billingHouseNumber.trim() || null,
          billingTaxNumber: billing.billingTaxNumber.trim() || null
        }
      })
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success('Számlázási adatok mentve.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Számlázási adatok</DialogTitle>
          <DialogDescription className="mt-1">
            {detail.sale_number} — csak ezen az eladáson. Az ügyféltörzset nem
            írja felül.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto px-4 py-3">
          <DocumentBillingFields
            value={billing}
            onChange={setBilling}
            disabled={pending}
            idPrefix="sale-detail-bill"
            enableTaxpayerLookup
            autoFocusTax={!billing.billingTaxNumber}
            hint="Adószám kitöltése után automatikus cégadat-lekérdezés."
          />
          {error ? (
            <p className="text-hint text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" loading={pending} onClick={handleSave}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
