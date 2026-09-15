'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
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
import { Textarea } from '@/components/ui/textarea'
import type { AccessoryListItem } from '@/lib/accessories/queries'
import {
  formatMoneyFt,
  formatHuNumber,
  netFromGross,
  parseIntegerInput
} from '@/lib/accessories/parse'
import {
  addQuoteAccessory,
  softDeleteQuoteAccessory
} from '@/lib/quotes/accessory-actions'
import type { QuoteAccessoryRow } from '@/lib/quotes/accessory-totals'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import { QUOTE_PAID_TOTALS_WARNING } from '@/lib/quotes/payment-labels'

type QuoteAccessoriesBlockProps = {
  quoteId: string
  currency: string
  accessories: QuoteAccessoryRow[]
  accessoryOptions: AccessoryListItem[]
  canEdit: boolean
  hasRecordedPayments?: boolean
}

export function QuoteAccessoriesBlock({
  quoteId,
  currency,
  accessories,
  accessoryOptions,
  canEdit,
  hasRecordedPayments = false
}: QuoteAccessoriesBlockProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuoteAccessoryRow | null>(
    null
  )
  const [accessoryId, setAccessoryId] = useState('')
  const [quantityRaw, setQuantityRaw] = useState('1')
  const [grossRaw, setGrossRaw] = useState('')
  const [comment, setComment] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const selected = accessoryOptions.find((t) => t.id === accessoryId)
  const quantity = parseIntegerInput(quantityRaw) ?? 0
  const unitGross = parseIntegerInput(grossRaw)
  const vatPercent = selected?.tax_rate_percent ?? 0

  const preview = useMemo(() => {
    if (unitGross === null || quantity < 1) return null
    const unitNet = netFromGross(unitGross, vatPercent)
    const lineGross = unitGross * quantity
    const lineNet = Math.round(unitNet * quantity)
    const lineVat = lineGross - lineNet
    return { lineGross, lineNet, lineVat }
  }, [unitGross, quantity, vatPercent])

  function resetForm() {
    setAccessoryId(accessoryOptions[0]?.id ?? '')
    setQuantityRaw('1')
    setGrossRaw(
      accessoryOptions[0] ? String(accessoryOptions[0].price_gross) : ''
    )
    setComment('')
    setFieldErrors({})
  }

  function openCreate() {
    resetForm()
    if (accessoryOptions[0]) {
      setAccessoryId(accessoryOptions[0].id)
      setGrossRaw(String(accessoryOptions[0].price_gross))
    }
    setOpen(true)
  }

  function handleAccessoryChange(id: string) {
    setAccessoryId(id)
    const t = accessoryOptions.find((x) => x.id === id)
    if (t) setGrossRaw(String(t.price_gross))
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await addQuoteAccessory({
        quoteId,
        accessoryId,
        quantity: quantity < 1 ? 0 : quantity,
        unitPriceGross: unitGross ?? -1,
        comment
      })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success('Termék hozzáadva.')
      setOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteQuoteAccessory({
        quoteId,
        accessoryLineId: deleteTarget.id
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Sor törölve.')
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const unitGrossDisplay = (row: QuoteAccessoryRow) => {
    const abs = Math.abs(row.gross_price / row.quantity)
    return Math.round(abs)
  }

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-border bg-subtle/40">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-2">
        <h3 className="text-label font-semibold text-ink">Termékek</h3>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            disabled={accessoryOptions.length === 0}
          >
            <Plus className="size-3.5" aria-hidden />
            Termék hozzáadása
          </Button>
        ) : null}
      </div>

      {canEdit && hasRecordedPayments ? (
        <p className="border-b border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
          {QUOTE_PAID_TOTALS_WARNING}
        </p>
      ) : null}

      {accessoryOptions.length === 0 && canEdit ? (
        <p className="px-3 py-3 text-body text-ink-secondary">
          Nincs aktív termék. Vedd fel a Törzsadatok → Termékek alatt.
        </p>
      ) : accessories.length === 0 ? (
        <p className="px-3 py-3 text-center text-body text-ink-secondary">
          Még nincs termék az ajánlaton.
        </p>
      ) : (
        <DataTable className="rounded-none border-0">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Megnevezés</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Mennyiség
              </DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Egységár
              </DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Bruttó
              </DataTableHeaderCell>
              {canEdit ? (
                <DataTableHeaderCell className="text-right">
                  Művelet
                </DataTableHeaderCell>
              ) : null}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {accessories.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell className="text-ink">
                  <span className="font-medium">{row.accessory_name}</span>
                  <span className="mt-0.5 block text-hint text-ink-secondary">
                    {row.sku}
                    {row.comment ? ` · ${row.comment}` : ''}
                  </span>
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {row.quantity} {row.unit_shortform || 'db'}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {formatQuotePrice(unitGrossDisplay(row), currency)}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums font-medium text-ink">
                  {formatQuotePrice(Math.round(row.gross_price), currency)}
                </DataTableCell>
                {canEdit ? (
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger-ink hover:text-danger-ink"
                      onClick={() => setDeleteTarget(row)}
                    >
                      Törlés
                    </Button>
                  </DataTableCell>
                ) : null}
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v)
        }}
      >
        <DialogContent className="max-w-[560px] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Termék hozzáadása</DialogTitle>
            <DialogDescription>
              A törzsárat felülírhatod. Az ajánlaton snapshot készül.
              {hasRecordedPayments ? ` ${QUOTE_PAID_TOTALS_WARNING}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-3">
            <FormField
              label="Termék"
              htmlFor="quote-accessory"
              required
              error={fieldErrors.accessoryId}
            >
              <MenuSelect
                id="quote-accessory"
                value={accessoryId}
                disabled={pending}
                allowEmpty={false}
                searchable
                searchPlaceholder="Termék vagy cikkszám…"
                placeholder="Válassz…"
                options={accessoryOptions.map((t) => ({
                  value: t.id,
                  label: t.name,
                  hint: `${t.sku} · ${formatMoneyFt(t.price_gross)}/${t.unit_shortform}`
                }))}
                onChange={handleAccessoryChange}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                className="min-w-0"
                label="Mennyiség"
                htmlFor="quote-accessory-qty"
                required
                error={fieldErrors.quantity}
                hint={selected ? selected.unit_shortform : undefined}
              >
                <Input
                  id="quote-accessory-qty"
                  value={quantityRaw}
                  onChange={(e) => setQuantityRaw(e.target.value)}
                  inputMode="numeric"
                  disabled={pending}
                />
              </FormField>
              <FormField
                className="min-w-0"
                label="Bruttó egységár"
                htmlFor="quote-accessory-gross"
                required
                error={fieldErrors.unitPriceGross}
                hint={
                  selected ? `Ft / ${selected.unit_shortform}` : 'Ft'
                }
              >
                <Input
                  id="quote-accessory-gross"
                  value={grossRaw}
                  onChange={(e) => setGrossRaw(e.target.value)}
                  inputMode="numeric"
                  disabled={pending}
                />
              </FormField>
            </div>

            <FormField
              label="Megjegyzés"
              htmlFor="quote-accessory-comment"
              optionalLabel
            >
              <Textarea
                id="quote-accessory-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                disabled={pending}
              />
            </FormField>

            {preview ? (
              <div className="space-y-1 rounded-md border border-border bg-subtle px-3 py-2 text-body">
                <div className="flex justify-between text-ink-secondary">
                  <span>Nettó</span>
                  <span className="tabular-nums">
                    {formatMoneyFt(preview.lineNet)}
                  </span>
                </div>
                <div className="flex justify-between text-ink-secondary">
                  <span>ÁFA ({formatHuNumber(vatPercent)}%)</span>
                  <span className="tabular-nums">
                    {formatMoneyFt(preview.lineVat)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold text-ink">
                  <span>Bruttó</span>
                  <span className="tabular-nums">
                    {formatMoneyFt(preview.lineGross)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSubmit}>
              Hozzáadás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => {
          if (!v && !pending) setDeleteTarget(null)
        }}
        title="Sor törlése?"
        description={
          deleteTarget
            ? `A „${deleteTarget.accessory_name}” eltávolításra kerül az ajánlatról.${
                hasRecordedPayments ? ` ${QUOTE_PAID_TOTALS_WARNING}` : ''
              }`
            : ''
        }
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
