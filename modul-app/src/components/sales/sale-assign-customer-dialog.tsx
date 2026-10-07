'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { CustomerMenuSelect } from '@/components/customers/customer-menu-select'
import { SaleQuickCustomerDialog } from '@/components/sales/sale-quick-customer-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { assignSaleCustomerAction } from '@/lib/sales/actions'
import type { OptiCustomerOption } from '@/lib/customers/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  salesOrderId: string
  saleNumber: string
  /** true = csere (már van ügyfél), false = hozzárendelés (vendég) */
  isReplace: boolean
  seed?: OptiCustomerOption[]
}

export function SaleAssignCustomerDialog({
  open,
  onOpenChange,
  salesOrderId,
  saleNumber,
  isReplace,
  seed = []
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState(seed)
  const [pullBilling, setPullBilling] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustomerId('')
    setCustomers(seed)
    setPullBilling(true)
    setError(null)
    setQuickOpen(false)
  }, [open, seed])

  function handleSave(id: string | null = customerId || null) {
    const nextId = id && id.trim() ? id : null
    if (!nextId && !isReplace) {
      setError('Válassz ügyfelet.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await assignSaleCustomerAction({
        salesOrderId,
        customerId: nextId,
        pullBilling: nextId ? pullBilling : false
      })
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(
        !nextId
          ? 'Vendégre állítva.'
          : isReplace
            ? 'Ügyfél cserélve.'
            : 'Ügyfél hozzárendelve.'
      )
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 overflow-x-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>
              {isReplace ? 'Ügyfél csere' : 'Ügyfél hozzárendelése'}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {saleNumber} — csak ezen az eladáson. Az ügyféltörzset nem írja
              felül.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-3 px-4 py-3">
            <div className="min-w-0 space-y-1.5">
              <label
                htmlFor="sale-assign-customer"
                className="text-hint font-medium text-ink-secondary"
              >
                Ügyfél
              </label>
              <CustomerMenuSelect
                id="sale-assign-customer"
                className="min-w-0 w-full"
                value={customerId}
                seed={customers}
                allowEmpty={isReplace}
                emptyLabel="Vendég / nincs ügyfél"
                portal={false}
                placeholder="Ügyfél keresése…"
                onChange={(id, c) => {
                  setCustomerId(id)
                  setError(null)
                  if (c) {
                    setCustomers((prev) =>
                      prev.some((x) => x.id === c.id) ? prev : [c, ...prev]
                    )
                  }
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setQuickOpen(true)}
              >
                <UserPlus className="size-3.5" aria-hidden />
                Új ügyfél
              </Button>
              {isReplace ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleSave(null)}
                >
                  Vendégre állítás
                </Button>
              ) : null}
            </div>

            {customerId ? (
              <label className="flex cursor-pointer items-start gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0 rounded border-border"
                  checked={pullBilling}
                  disabled={pending}
                  onChange={(e) => setPullBilling(e.target.checked)}
                />
                <span>
                  Számlázási adatok behúzása az ügyfélről
                  <span className="mt-0.5 block text-hint text-ink-muted">
                    Felülírja az eladáson rögzített számlázási snapshotot.
                  </span>
                </span>
              </label>
            ) : null}

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
            <Button
              type="button"
              loading={pending}
              disabled={!customerId && !isReplace}
              onClick={() => handleSave()}
            >
              {customerId || !isReplace ? 'Ügyfél mentése' : 'Vendégre állítás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaleQuickCustomerDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={(c) => {
          setCustomers((prev) =>
            prev.some((x) => x.id === c.id)
              ? prev
              : [
                  {
                    id: c.id,
                    name: c.name,
                    email: null,
                    mobile: c.mobile,
                    billing_name: null,
                    billing_country: 'Magyarország',
                    billing_city: null,
                    billing_postal_code: null,
                    billing_street: null,
                    billing_house_number: null,
                    billing_tax_number: null
                  },
                  ...prev
                ]
          )
          setCustomerId(c.id)
          handleSave(c.id)
        }}
      />
    </>
  )
}
