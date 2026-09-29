'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import {
  leadSpecialOrderItemsToSupplierAction,
  previewSpecialOrderLeadDraftsAction,
  type CsoLeadSupplierPreview,
  type CsoLeadSupplierTarget
} from '@/lib/customer-orders/actions'
import { cn } from '@/lib/utils'

type Choice =
  | { kind: 'new' }
  | { kind: 'append'; purchaseOrderId: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemIds: string[]
  /** Részletről — revalidate hint. */
  orderId?: string
  onSuccess?: () => void
}

function defaultChoice(supplier: CsoLeadSupplierPreview): Choice {
  if (supplier.drafts.length === 1) {
    return { kind: 'append', purchaseOrderId: supplier.drafts[0]!.id }
  }
  if (supplier.drafts.length > 1) {
    return { kind: 'append', purchaseOrderId: supplier.drafts[0]!.id }
  }
  return { kind: 'new' }
}

export function CsoLeadOrderDialog({
  open,
  onOpenChange,
  itemIds,
  orderId,
  onSuccess
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = useTransition()
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [suppliers, setSuppliers] = useState<CsoLeadSupplierPreview[]>([])
  const [warehouseId, setWarehouseId] = useState<string | undefined>()
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || itemIds.length === 0) return
    let cancelled = false
    setLoadingPreview(true)
    setPreviewError(null)
    setSuppliers([])
    setChoices({})

    void (async () => {
      const res = await previewSpecialOrderLeadDraftsAction({ itemIds })
      if (cancelled) return
      setLoadingPreview(false)
      if (!res.ok) {
        setPreviewError(res.message)
        return
      }
      setWarehouseId(res.warehouseId)
      setSuppliers(res.suppliers)
      const next: Record<string, Choice> = {}
      for (const s of res.suppliers) {
        next[s.supplierId] = defaultChoice(s)
      }
      setChoices(next)
      window.setTimeout(() => cancelRef.current?.focus(), 0)
    })()

    return () => {
      cancelled = true
    }
  }, [open, itemIds])

  const needsChoice = useMemo(
    () => suppliers.some((s) => s.drafts.length > 0),
    [suppliers]
  )

  const canConfirm =
    !loadingPreview &&
    !previewError &&
    suppliers.length > 0 &&
    suppliers.every((s) => {
      const c = choices[s.supplierId]
      if (!c) return false
      if (c.kind === 'append') {
        return s.drafts.some((d) => d.id === c.purchaseOrderId)
      }
      return true
    })

  function setChoice(supplierId: string, choice: Choice) {
    setChoices((prev) => ({ ...prev, [supplierId]: choice }))
  }

  function confirm() {
    if (!canConfirm) return
    const supplierTargets: Record<string, CsoLeadSupplierTarget> = {}
    for (const s of suppliers) {
      const c = choices[s.supplierId]!
      supplierTargets[s.supplierId] =
        c.kind === 'append'
          ? { mode: 'append', purchaseOrderId: c.purchaseOrderId }
          : { mode: 'new' }
    }

    startTransition(async () => {
      const res = await leadSpecialOrderItemsToSupplierAction({
        orderId,
        itemIds,
        warehouseId,
        supplierTargets
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Vázlat kész / frissítve.')
      onOpenChange(false)
      onSuccess?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Beszállítótól megrendel</DialogTitle>
          <DialogDescription>
            {needsChoice
              ? 'Ha van nyitott vázlat ugyanennél a beszállítónál, ide teheted — vagy újat nyitsz.'
              : 'Beszállítónként új beszállítói rendelés vázlat készül (beszerzési áron).'}
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <p className="text-[13px] text-ink-secondary">Vázlatok ellenőrzése…</p>
        ) : null}

        {previewError ? (
          <p className="text-[13px] text-danger" role="alert">
            {previewError}
          </p>
        ) : null}

        {!loadingPreview && !previewError && suppliers.length > 0 ? (
          <ul className="space-y-3">
            {suppliers.map((s) => {
              const choice = choices[s.supplierId] ?? { kind: 'new' as const }
              const value =
                choice.kind === 'append'
                  ? `append:${choice.purchaseOrderId}`
                  : 'new'

              return (
                <li
                  key={s.supplierId}
                  className="rounded-md border border-border bg-subtle/40 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13.5px] font-medium text-ink">
                      {s.supplierName}
                    </span>
                    <span className="text-[12px] tabular-nums text-ink-muted">
                      {s.itemCount} tétel
                    </span>
                  </div>

                  {s.drafts.length === 0 ? (
                    <p className="mt-1 text-[12.5px] text-ink-secondary">
                      Nincs nyitott vázlat → új vázlat készül.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      <label className="block text-[12px] text-ink-muted">
                        Hová kerüljön?
                      </label>
                      <Select
                        value={value}
                        disabled={pending}
                        className="h-8"
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'new') {
                            setChoice(s.supplierId, { kind: 'new' })
                            return
                          }
                          if (v.startsWith('append:')) {
                            setChoice(s.supplierId, {
                              kind: 'append',
                              purchaseOrderId: v.slice('append:'.length)
                            })
                          }
                        }}
                      >
                        {s.drafts.map((d) => (
                          <option key={d.id} value={`append:${d.id}`}>
                            Hozzáadás: {d.poNumber} ({d.itemCount} sor a
                            vázlatban)
                          </option>
                        ))}
                        <option value="new">Új vázlat</option>
                      </Select>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={pending}
            disabled={!canConfirm || pending}
            className={cn(!canConfirm && 'opacity-60')}
            onClick={confirm}
          >
            Megrendelés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
