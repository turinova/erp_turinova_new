'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { ProductLabelSheet } from '@/components/labels/product-label-sheet'
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
import { LABEL_TEMPLATES, type LabelTemplateId } from '@/lib/labels/layout'
import { printProductLabels } from '@/lib/labels/print-label'
import {
  labelBarcodeValue,
  type LabelFields,
  type ProductLabelPayload
} from '@/lib/labels/types'
import { cn } from '@/lib/utils'

type UnitOption = { id: string; name: string; shortform: string }

type Props = {
  open: boolean
  payload: ProductLabelPayload | null
  units: UnitOption[]
  onClose: () => void
  /** Default példányszám (pl. beérkezett qty). */
  initialAmount?: number
}

const FIELD_CHIPS: Array<{ key: keyof LabelFields; label: string }> = [
  { key: 'showName', label: 'Név' },
  { key: 'showSku', label: 'SKU' },
  { key: 'showPrice', label: 'Ár' },
  { key: 'showBarcode', label: 'Vonalkód' }
]

export function ProductLabelPrintDialog({
  open,
  payload,
  units,
  onClose,
  initialAmount = 1
}: Props) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [unit, setUnit] = useState('db')
  const [amount, setAmount] = useState(1)
  const [templateId, setTemplateId] = useState<LabelTemplateId | 'custom'>(
    'full'
  )
  const [fields, setFields] = useState<LabelFields>({
    showName: true,
    showSku: true,
    showBarcode: true,
    showPrice: true
  })
  const [printing, setPrinting] = useState(false)

  const barcode = payload ? labelBarcodeValue(payload) : null
  const hasBarcode = Boolean(barcode)

  useEffect(() => {
    if (!open || !payload) return
    const bc = Boolean(labelBarcodeValue(payload))
    setName(payload.name)
    setPrice(Math.round(payload.priceGross))
    setUnit(payload.unitShortform || 'db')
    setAmount(Math.max(1, Math.round(initialAmount) || 1))
    setTemplateId('full')
    setFields(LABEL_TEMPLATES[0].fields(bc))
  }, [open, payload, initialAmount])

  const unitOptions = useMemo(() => {
    const opts = units.map((u) => ({
      value: u.shortform,
      label: u.shortform,
      hint: u.name
    }))
    if (unit && !opts.some((o) => o.value === unit)) {
      opts.unshift({ value: unit, label: unit, hint: 'Jelenlegi' })
    }
    return opts
  }, [units, unit])

  function applyTemplate(id: LabelTemplateId) {
    const tpl = LABEL_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    setTemplateId(id)
    setFields(tpl.fields(hasBarcode))
  }

  function toggleField(key: keyof LabelFields) {
    if (key === 'showBarcode' && !hasBarcode) return
    setTemplateId('custom')
    setFields((f) => ({ ...f, [key]: !f[key] }))
  }

  async function handlePrint() {
    if (!payload) return
    if (
      !fields.showName &&
      !fields.showSku &&
      !fields.showBarcode &&
      !fields.showPrice
    ) {
      toast.error('Válassz ki legalább egy mezőt a címkéhez.')
      return
    }
    setPrinting(true)
    try {
      await printProductLabels({
        payload,
        fields,
        productName: name,
        price,
        unitShortform: unit || 'db',
        size: '33x25',
        amount
      })
    } catch (err) {
      console.error(err)
      toast.error('A nyomtatás sikertelen.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Dialog
      open={open && Boolean(payload)}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Címke nyomtatása</DialogTitle>
          <DialogDescription>
            Az előnézet élőben követi a beállításokat. Kikapcsolt mezőknél a
            vonalkód nagyobb helyet kap.
          </DialogDescription>
        </DialogHeader>

        {payload ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            {/* Preview first */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-stone-50 p-5">
              <p className="text-hint text-ink-secondary">
                Előnézet · 33×25 mm
              </p>
              <div className="rounded-md border border-border bg-white p-4 shadow-sm">
                <ProductLabelSheet
                  payload={payload}
                  fields={fields}
                  productName={name}
                  price={price}
                  unitShortform={unit || 'db'}
                  size="33x25"
                  mode="preview"
                  previewScale={9}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3.5">
              <fieldset className="space-y-1.5">
                <legend className="text-label font-medium text-ink">
                  Sablon
                </legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {LABEL_TEMPLATES.map((tpl) => {
                    const disabled = tpl.id === 'barcode' && !hasBarcode
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => applyTemplate(tpl.id)}
                        className={cn(
                          'rounded-md border px-2 py-1.5 text-left transition-colors',
                          templateId === tpl.id
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-surface hover:bg-subtle',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        <span className="block text-[13px] font-medium text-ink">
                          {tpl.label}
                        </span>
                        <span className="block text-[11px] text-ink-muted">
                          {tpl.hint}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-1.5">
                <legend className="text-label font-medium text-ink">
                  Mezők
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_CHIPS.map(({ key, label }) => {
                    const disabled = key === 'showBarcode' && !hasBarcode
                    const on = fields[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleField(key)}
                        aria-pressed={on}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                          on
                            ? 'border-primary/30 bg-primary text-white'
                            : 'border-border bg-surface text-ink-secondary hover:bg-subtle',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {!hasBarcode ? (
                  <p className="text-hint text-ink-muted">
                    Nincs vonalkód a terméken — add meg a törzsadatban.
                  </p>
                ) : null}
              </fieldset>

              <FormField label="Termék neve" htmlFor="label-name">
                <Input
                  id="label-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!fields.showName}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Ár (Ft)" htmlFor="label-price">
                  <Input
                    id="label-price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    disabled={!fields.showPrice}
                    onChange={(e) =>
                      setPrice(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="tabular-nums"
                  />
                </FormField>
                <FormField label="Egység" htmlFor="label-unit">
                  <MenuSelect
                    id="label-unit"
                    value={unit}
                    options={unitOptions}
                    onChange={setUnit}
                    allowEmpty={false}
                    disabled={!fields.showPrice}
                  />
                </FormField>
              </div>

              <FormField label="Példány" htmlFor="label-amount">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Kevesebb"
                    disabled={amount <= 1}
                    onClick={() => setAmount((n) => Math.max(1, n - 1))}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>
                  <Input
                    id="label-amount"
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) =>
                      setAmount(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-20 text-center tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Több"
                    onClick={() => setAmount((n) => n + 1)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </FormField>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={printing}
          >
            Mégse
          </Button>
          <Button
            type="button"
            onClick={() => void handlePrint()}
            loading={printing}
            disabled={!payload}
          >
            <Printer className="size-3.5" aria-hidden />
            Nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
