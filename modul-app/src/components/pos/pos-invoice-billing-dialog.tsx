'use client'

import { useEffect, useRef, useState } from 'react'

import {
  DocumentBillingFields,
  billingHasAny,
  type DocumentBillingState
} from '@/components/sales/document-billing-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: DocumentBillingState
  onSave: (billing: DocumentBillingState) => void
  onClear: () => void
  /** Ha már be van kapcsolva a számla — mutatja a törlés gombot */
  canClear: boolean
}

export function PosInvoiceBillingDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onClear,
  canClear
}: Props) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(initial)
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Számlázási adatok</DialogTitle>
          <p className="mt-1 text-hint text-ink-secondary">
            Csak ezen az eladáson. Az ügyféltörzset nem írja felül.
          </p>
        </DialogHeader>

        <div className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto px-4 py-3">
          <DocumentBillingFields
            value={draft}
            onChange={setDraft}
            idPrefix="pos-inv"
            hint=""
          />
          {error ? (
            <p className="text-hint text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-between">
          {canClear ? (
            <Button
              type="button"
              variant="ghost"
              className="text-danger-ink sm:mr-auto"
              onClick={() => {
                onClear()
                onOpenChange(false)
              }}
            >
              Számla törlése
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!billingHasAny(draft)) {
                  setError('Adj meg legalább egy számlázási mezőt.')
                  return
                }
                onSave(draft)
                onOpenChange(false)
              }}
            >
              Mentés
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

