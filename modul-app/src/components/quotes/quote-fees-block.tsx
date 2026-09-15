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
import { StatusBadge } from '@/components/patterns/status-badge'
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
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FeeTypeListItem } from '@/lib/fee-types/queries'
import {
  formatMoneyFt,
  formatHuNumber,
  netFromGross,
  parseIntegerInput
} from '@/lib/fee-types/parse'
import { addQuoteFee, softDeleteQuoteFee } from '@/lib/quotes/fee-actions'
import type { QuoteFeeKind, QuoteFeeRow } from '@/lib/quotes/fee-totals'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import {
  QUOTE_CREDIT_OVERPAY_HINT,
  QUOTE_PAID_TOTALS_WARNING
} from '@/lib/quotes/payment-labels'
import { cn } from '@/lib/utils'

type QuoteFeesBlockProps = {
  quoteId: string
  currency: string
  fees: QuoteFeeRow[]
  feeTypes: FeeTypeListItem[]
  canEdit: boolean
  hasRecordedPayments?: boolean
}

export function QuoteFeesBlock({
  quoteId,
  currency,
  fees,
  feeTypes,
  canEdit,
  hasRecordedPayments = false
}: QuoteFeesBlockProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuoteFeeRow | null>(null)
  const [kind, setKind] = useState<QuoteFeeKind>('fee')
  const [feeTypeId, setFeeTypeId] = useState('')
  const [quantityRaw, setQuantityRaw] = useState('1')
  const [grossRaw, setGrossRaw] = useState('')
  const [comment, setComment] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const selectedType = feeTypes.find((t) => t.id === feeTypeId)
  const quantity = parseIntegerInput(quantityRaw) ?? 0
  const unitGross = parseIntegerInput(grossRaw)
  const vatPercent = selectedType?.tax_rate_percent ?? 0

  const preview = useMemo(() => {
    if (unitGross === null || quantity < 1) return null
    const sign = kind === 'credit' ? -1 : 1
    const unitNetAbs = netFromGross(unitGross, vatPercent)
    const lineGross = unitGross * quantity * sign
    const lineNet = Math.round(unitNetAbs * quantity * sign)
    const lineVat = lineGross - lineNet
    return { lineGross, lineNet, lineVat }
  }, [unitGross, quantity, kind, vatPercent])

  function resetForm() {
    setKind('fee')
    setFeeTypeId(feeTypes[0]?.id ?? '')
    setQuantityRaw('1')
    setGrossRaw(feeTypes[0] ? String(feeTypes[0].price_gross) : '')
    setComment('')
    setFieldErrors({})
  }

  function openCreate() {
    resetForm()
    if (feeTypes[0]) {
      setFeeTypeId(feeTypes[0].id)
      setGrossRaw(String(feeTypes[0].price_gross))
    }
    setOpen(true)
  }

  function handleFeeTypeChange(id: string) {
    setFeeTypeId(id)
    const t = feeTypes.find((x) => x.id === id)
    if (t) setGrossRaw(String(t.price_gross))
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await addQuoteFee({
        quoteId,
        feeTypeId,
        kind,
        quantity: quantity < 1 ? 0 : quantity,
        unitPriceGross: unitGross ?? -1,
        comment
      })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success(kind === 'credit' ? 'Jóváírás hozzáadva.' : 'Díj hozzáadva.')
      setOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteQuoteFee({
        quoteId,
        feeId: deleteTarget.id
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

  const unitGrossDisplay = (fee: QuoteFeeRow) => {
    const abs = Math.abs(fee.gross_price / fee.quantity)
    return Math.round(abs)
  }

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-border bg-subtle/40">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-2">
        <h3 className="text-label font-semibold text-ink">Egyéb díjak</h3>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            disabled={feeTypes.length === 0}
          >
            <Plus className="size-3.5" aria-hidden />
            Díj hozzáadása
          </Button>
        ) : null}
      </div>

      {canEdit && hasRecordedPayments ? (
        <p className="border-b border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
          {QUOTE_PAID_TOTALS_WARNING}
        </p>
      ) : null}

      {feeTypes.length === 0 && canEdit ? (
        <p className="px-3 py-3 text-body text-ink-secondary">
          Nincs aktív díjtípus. Vedd fel a Törzsadatok → Díj típusok alatt.
        </p>
      ) : fees.length === 0 ? (
        <p className="px-3 py-3 text-center text-body text-ink-secondary">
          Még nincs egyéb díj vagy jóváírás.
        </p>
      ) : (
        <DataTable className="rounded-none border-0">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Megnevezés</DataTableHeaderCell>
              <DataTableHeaderCell>Típus</DataTableHeaderCell>
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
            {fees.map((fee) => (
              <DataTableRow key={fee.id}>
                <DataTableCell className="text-ink">
                  <span className="font-medium">{fee.fee_name}</span>
                  {fee.comment ? (
                    <span className="mt-0.5 block text-hint text-ink-secondary">
                      {fee.comment}
                    </span>
                  ) : null}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={fee.kind === 'credit' ? 'warning' : 'neutral'}
                  >
                    {fee.kind === 'credit' ? 'Jóváírás' : 'Díj'}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {fee.quantity} {fee.unit_shortform || 'db'}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {formatQuotePrice(unitGrossDisplay(fee), currency)}
                </DataTableCell>
                <DataTableCell
                  className={cn(
                    'text-right tabular-nums font-medium',
                    fee.gross_price < 0 ? 'text-warning-ink' : 'text-ink'
                  )}
                >
                  {formatQuotePrice(Math.round(fee.gross_price), currency)}
                </DataTableCell>
                {canEdit ? (
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger-ink hover:text-danger-ink"
                      onClick={() => setDeleteTarget(fee)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Díj / jóváírás hozzáadása</DialogTitle>
            <DialogDescription>
              A törzsárat felülírhatod. A jóváírás levonódik az ajánlat
              végösszegéből.
              {hasRecordedPayments
                ? ` ${QUOTE_PAID_TOTALS_WARNING}`
                : ''}
              {hasRecordedPayments && kind === 'credit'
                ? ` ${QUOTE_CREDIT_OVERPAY_HINT}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField label="Sor típusa" htmlFor="quote-fee-kind" required>
              <Select
                id="quote-fee-kind"
                value={kind}
                disabled={pending}
                onChange={(e) => setKind(e.target.value as QuoteFeeKind)}
              >
                <option value="fee">Díj</option>
                <option value="credit">Jóváírás</option>
              </Select>
            </FormField>

            <FormField
              label="Díjtípus"
              htmlFor="quote-fee-type"
              required
              error={fieldErrors.feeTypeId}
            >
              <Select
                id="quote-fee-type"
                value={feeTypeId}
                disabled={pending}
                onChange={(e) => handleFeeTypeChange(e.target.value)}
              >
                <option value="" disabled>
                  Válassz…
                </option>
                {feeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatMoneyFt(t.price_gross)}/{t.unit_shortform}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Mennyiség"
                htmlFor="quote-fee-qty"
                required
                error={fieldErrors.quantity}
                hint={selectedType ? selectedType.unit_shortform : undefined}
              >
                <Input
                  id="quote-fee-qty"
                  value={quantityRaw}
                  onChange={(e) => setQuantityRaw(e.target.value)}
                  inputMode="numeric"
                  disabled={pending}
                />
              </FormField>
              <FormField
                label="Bruttó egységár"
                htmlFor="quote-fee-gross"
                required
                error={fieldErrors.unitPriceGross}
                hint={
                  selectedType
                    ? `Ft / ${selectedType.unit_shortform}`
                    : 'Ft'
                }
              >
                <Input
                  id="quote-fee-gross"
                  value={grossRaw}
                  onChange={(e) => setGrossRaw(e.target.value)}
                  inputMode="numeric"
                  disabled={pending}
                />
              </FormField>
            </div>

            <FormField
              label="Megjegyzés"
              htmlFor="quote-fee-comment"
              optionalLabel
            >
              <Textarea
                id="quote-fee-comment"
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
            ? `A „${deleteTarget.fee_name}” eltávolításra kerül az ajánlatról.${
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
