'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
import type { ProductionMachineOption } from '@/lib/production-machines/queries'
import {
  assignQuoteProduction,
  clearQuoteProduction
} from '@/lib/quotes/production-actions'
import { defaultProductionDateIso } from '@/lib/quotes/production-utils'

type ExistingAssignment = {
  productionMachineId: string | null
  productionDate: string | null
  barcode: string | null
} | null

type AssignProductionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  orderNumber: string
  machines: ProductionMachineOption[]
  existing: ExistingAssignment
  onSuccess: () => void
}

function normalizeBarcodeInput(value: string): string {
  return value.replace(/\s+/g, '')
}

export function AssignProductionDialog({
  open,
  onOpenChange,
  quoteId,
  orderNumber,
  machines,
  existing,
  onSuccess
}: AssignProductionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const isEdit = Boolean(existing?.productionMachineId)

  const [machineId, setMachineId] = useState('')
  const [productionDate, setProductionDate] = useState('')
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!open) return
    setMachineId(
      existing?.productionMachineId &&
        machines.some((m) => m.id === existing.productionMachineId)
        ? existing.productionMachineId
        : (machines[0]?.id ?? '')
    )
    setProductionDate(
      existing?.productionDate ?? defaultProductionDateIso()
    )
    setBarcode(existing?.barcode ?? '')
    setError(null)
    const id = window.setTimeout(() => barcodeRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open, existing, machines])

  async function handleSubmit() {
    if (!machineId) {
      setError(
        machines.length === 0
          ? 'Nincs aktív gyártógép. Előbb vedd fel a törzsben.'
          : 'Válassz gyártógépet.'
      )
      return
    }
    if (!productionDate) {
      setError('Add meg a gyártás dátumát.')
      return
    }
    if (!barcode.trim()) {
      setError('A vonalkód kötelező.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const result = await assignQuoteProduction({
        quoteId,
        productionMachineId: machineId,
        productionDate,
        barcode
      })
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(
        isEdit
          ? 'Gyártás sikeresen módosítva.'
          : 'Megrendelés sikeresen gyártásba adva.'
      )
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      const result = await clearQuoteProduction(quoteId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Gyártás hozzárendelés törölve.')
      setClearConfirmOpen(false)
      onOpenChange(false)
      onSuccess()
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!loading && !clearing) onOpenChange(next)
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Gyártás módosítása' : 'Gyártásba adás'}
            </DialogTitle>
            <DialogDescription>
              Megrendelés: <strong>{orderNumber}</strong>. Gép, dátum és vonalkód
              kötelező.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField label="Gyártógép" htmlFor="assign-machine" required>
              {machines.length === 0 ? (
                <p className="rounded-md border border-warning/30 bg-warning-soft p-2 text-body text-warning-ink">
                  Nincs aktív gyártógép.{' '}
                  <Link
                    href="/torzsadatok/rendszer/gyartogepek"
                    className="font-medium underline"
                  >
                    Vedd fel a törzsben
                  </Link>
                  .
                </p>
              ) : (
                <MenuSelect
                  id="assign-machine"
                  value={machineId}
                  disabled={loading}
                  allowEmpty={false}
                  placeholder="Válassz gépet…"
                  options={machines.map((m) => ({
                    value: m.id,
                    label: m.name
                  }))}
                  onChange={setMachineId}
                />
              )}
            </FormField>

            <FormField
              label="Gyártás dátuma"
              htmlFor="assign-date"
              required
            >
              <Input
                id="assign-date"
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                disabled={loading}
              />
            </FormField>

            <FormField
              label="Vonalkód"
              htmlFor="assign-barcode"
              required
              hint="Fizikai vonalkód-olvasó használata ajánlott."
            >
              <Input
                ref={barcodeRef}
                id="assign-barcode"
                value={barcode}
                onChange={(e) =>
                  setBarcode(normalizeBarcodeInput(e.target.value))
                }
                placeholder="Beolvasás vagy kézi megadás"
                disabled={loading}
                autoComplete="off"
              />
            </FormField>

            {error ? (
              <p className="text-body text-danger-ink" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-auto">
              {isEdit ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={loading || clearing}
                  onClick={() => setClearConfirmOpen(true)}
                >
                  Gyártás törlése
                </Button>
              ) : null}
            </div>
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button
                ref={cancelRef}
                type="button"
                variant="secondary"
                disabled={loading || clearing}
                onClick={() => onOpenChange(false)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={loading}
                disabled={loading || clearing || machines.length === 0}
                onClick={() => void handleSubmit()}
              >
                {isEdit ? 'Módosítás' : 'Gyártásba adás'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={(next) => {
          if (!clearing) setClearConfirmOpen(next)
        }}
        title="Gyártás törlése"
        description="Biztosan törölni szeretnéd a gyártás hozzárendelést? A státusz visszaáll Megrendelve-re, a vonalkód törlődik."
        confirmLabel="Törlés"
        variant="danger"
        loading={clearing}
        onConfirm={() => void handleClear()}
      />
    </>
  )
}
