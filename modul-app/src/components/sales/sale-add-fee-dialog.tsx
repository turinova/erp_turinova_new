'use client'

import { useEffect, useMemo, useState } from 'react'

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
import type { FeeTypeListItem } from '@/lib/fee-types/queries'
import { formatMoneyFt } from '@/lib/sales/parse'

export type SaleFeeDraft = {
  feeTypeId: string
  name: string
  unitPriceGross: number
  taxRatePercent: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  feeTypes: FeeTypeListItem[]
  onAdd: (fee: SaleFeeDraft) => void
}

export function SaleAddFeeDialog({
  open,
  onOpenChange,
  feeTypes,
  onAdd
}: Props) {
  const [feeTypeId, setFeeTypeId] = useState('')
  const [gross, setGross] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(
    () =>
      feeTypes.map((f) => ({
        value: f.id,
        label: f.name,
        hint: `${formatMoneyFt(f.price_gross)} Ft`
      })),
    [feeTypes]
  )

  useEffect(() => {
    if (!open) return
    const first = feeTypes[0]
    if (first) {
      setFeeTypeId(first.id)
      setGross(first.price_gross)
    } else {
      setFeeTypeId('')
      setGross(0)
    }
    setError(null)
  }, [open, feeTypes])

  function handleTypeChange(id: string) {
    setFeeTypeId(id)
    const t = feeTypes.find((f) => f.id === id)
    if (t) setGross(t.price_gross)
  }

  function handleSubmit() {
    const t = feeTypes.find((f) => f.id === feeTypeId)
    if (!t) {
      setError('Válassz díjtípust.')
      return
    }
    if (!(gross >= 0) || !Number.isFinite(gross)) {
      setError('Érvénytelen összeg.')
      return
    }
    onAdd({
      feeTypeId: t.id,
      name: t.name,
      unitPriceGross: Math.round(gross),
      taxRatePercent: t.tax_rate_percent
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Díj hozzáadása</DialogTitle>
          <DialogDescription>
            Válassz díjtípust a törzsből. Az összeg felülírható.
          </DialogDescription>
        </DialogHeader>

        {feeTypes.length === 0 ? (
          <p className="text-body text-warning-ink">
            Nincs aktív díjtípus. Vedd fel a Törzsadatok → Díj típusok alatt.
          </p>
        ) : (
          <div className="space-y-3">
            <FormField
              label="Díjtípus"
              htmlFor="sale-fee-type"
              required
              error={error && !feeTypeId ? error : undefined}
            >
              <MenuSelect
                id="sale-fee-type"
                value={feeTypeId}
                onChange={handleTypeChange}
                allowEmpty={false}
                searchable={feeTypes.length > 6}
                options={options}
              />
            </FormField>
            <FormField
              label="Bruttó Ft"
              htmlFor="sale-fee-gross"
              error={error && feeTypeId ? error : undefined}
            >
              <Input
                id="sale-fee-gross"
                type="number"
                min={0}
                className="tabular-nums"
                value={gross}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setGross(Number.isFinite(n) ? n : 0)
                }}
              />
            </FormField>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            disabled={feeTypes.length === 0}
            onClick={handleSubmit}
          >
            Hozzáadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
