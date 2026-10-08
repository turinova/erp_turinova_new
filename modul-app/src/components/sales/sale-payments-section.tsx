'use client'

import { Banknote, Pencil, Trash2 } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import {
  StatusBadge,
  type StatusBadgeTone
} from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  canEditSalePayment,
  salePaymentRemaining
} from '@/lib/sales/payment-edit'
import {
  formatMoneyFt,
  SALE_PAYMENT_STATUS_LABEL,
  salePaymentTone,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import type {
  SaleDetail,
  SalePaymentEventRow,
  SalePaymentRow
} from '@/lib/sales/queries'
import { cn } from '@/lib/utils'

const PAYMENT_EVENT_LABEL: Record<SalePaymentEventRow['event_type'], string> = {
  recorded: 'Rögzítve',
  voided: 'Érvénytelenítve',
  corrected: 'Korrekció',
  refunded: 'Visszatérítés',
  note: 'Megjegyzés'
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('hu-HU')
  } catch {
    return '—'
  }
}

function payMethodChip(name: string): {
  tone: 'success' | 'info' | 'neutral' | 'warning'
  variant: 'solid' | 'outline'
} {
  const n = name.toLowerCase()
  if (n.includes('készpénz') || n.includes('keszpenz') || n === 'cash') {
    return { tone: 'success', variant: 'solid' }
  }
  if (n.includes('kártya') || n.includes('kartya') || n.includes('card')) {
    return { tone: 'info', variant: 'solid' }
  }
  return { tone: 'neutral', variant: 'outline' }
}

function paymentEventTone(
  type: SalePaymentEventRow['event_type']
): StatusBadgeTone {
  switch (type) {
    case 'recorded':
      return 'success'
    case 'voided':
      return 'danger'
    case 'corrected':
    case 'refunded':
      return 'warning'
    default:
      return 'neutral'
  }
}

function paymentEventRowClass(type: SalePaymentEventRow['event_type']) {
  switch (type) {
    case 'voided':
      return 'bg-danger-soft/40 opacity-80'
    case 'corrected':
      return 'border-l-2 border-l-warning bg-warning-soft/40'
    case 'refunded':
      return 'bg-warning-soft/30'
    default:
      return undefined
  }
}

type Props = {
  detail: SaleDetail
  canWrite: boolean
  hasFinalInvoice: boolean
  canRecordPayment: boolean
  onRecordPayment: () => void
  onEditPayment: (payment: SalePaymentRow) => void
  onVoidPayment: (payment: SalePaymentRow) => void
}

export function SalePaymentsSection({
  detail,
  canWrite,
  hasFinalInvoice,
  canRecordPayment,
  onRecordPayment,
  onEditPayment,
  onVoidPayment
}: Props) {
  const paymentTone = salePaymentTone(
    detail.payment_status as SalePaymentStatus
  )
  const remaining = salePaymentRemaining(detail)
  const paidSum = detail.payments
    .filter((p) => p.kind === 'payment')
    .reduce((s, p) => s + p.amount, 0)
  const refundSum = detail.payments
    .filter((p) => p.kind === 'refund')
    .reduce((s, p) => s + p.amount, 0)
  const netPaid = paidSum - refundSum

  return (
    <section
      id="fizetesek"
      className="scroll-mt-16 space-y-3 rounded-md border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-body font-semibold text-ink">Fizetések</h2>
            <StatusBadge
              tone={paymentTone === 'neutral' ? 'neutral' : paymentTone}
              variant="soft"
            >
              {SALE_PAYMENT_STATUS_LABEL[
                detail.payment_status as SalePaymentStatus
              ] ?? detail.payment_status}
            </StatusBadge>
          </div>
          <p className="text-hint text-ink-secondary">
            {detail.payments.length > 0 ? (
              <>
                Érvényes egyenleg{' '}
                <span className="font-medium tabular-nums text-ink">
                  {formatMoneyFt(netPaid)} Ft
                </span>
                {remaining > 0 ? (
                  <>
                    {' · '}Hátralék{' '}
                    <span className="font-medium tabular-nums text-warning-ink">
                      {formatMoneyFt(remaining)} Ft
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              'Még nincs érvényes fizetés'
            )}
          </p>
        </div>
        {canRecordPayment ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRecordPayment}
          >
            <Banknote className="size-3.5" aria-hidden />
            Fizetés rögzítése
          </Button>
        ) : null}
      </div>

      {detail.payments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-hint text-ink-secondary">
          Még nincs rögzített fizetés
          {canRecordPayment
            ? ' — használd a Fizetés rögzítése gombot.'
            : '.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {detail.payments.map((p) => {
            const isRefund = p.kind === 'refund'
            const chip = isRefund
              ? ({ tone: 'warning' as const, variant: 'soft' as const })
              : payMethodChip(p.payment_method_name)
            const editable = canEditSalePayment({
              canWrite,
              saleStatus: detail.status as SaleStatus,
              paymentStatus: detail.payment_status as SalePaymentStatus,
              hasFinalInvoice,
              posShiftOpen: detail.pos_shift_open,
              payment: p
            })
            return (
              <li
                key={p.id}
                className="flex max-w-full items-center gap-1 rounded-md border border-border bg-subtle/60 py-1 pl-2 pr-1"
              >
                <div className="min-w-0 px-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={chip.tone} variant={chip.variant}>
                      {isRefund
                        ? `Visszatérítés · ${p.payment_method_name}`
                        : p.payment_method_name}
                    </StatusBadge>
                    <span
                      className={cn(
                        'text-body font-semibold tabular-nums',
                        isRefund ? 'text-warning-ink' : 'text-ink'
                      )}
                    >
                      {isRefund ? '−' : ''}
                      {formatMoneyFt(p.amount)} Ft
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                    {[p.created_by_label, formatDateTime(p.paid_at)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {editable ? (
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5"
                      aria-label="Fizetés korrekciója"
                      onClick={() => onEditPayment(p)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-danger-ink hover:text-danger-ink"
                      aria-label="Fizetés érvénytelenítése"
                      onClick={() => onVoidPayment(p)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div>
        <h3 className="mb-1.5 text-[12px] font-medium text-ink-secondary">
          Fizetési tevékenység
        </h3>
        {detail.payment_events.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-hint text-ink-secondary">
            Még nincs naplózott fizetési tevékenység.
          </p>
        ) : (
          <DataTable className="min-w-0">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell className="whitespace-nowrap">
                  Időpont
                </DataTableHeaderCell>
                <DataTableHeaderCell>Esemény</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell>
                <DataTableHeaderCell className="hidden sm:table-cell">
                  Mód
                </DataTableHeaderCell>
                <DataTableHeaderCell className="hidden md:table-cell">
                  Előtte
                </DataTableHeaderCell>
                <DataTableHeaderCell className="hidden lg:table-cell">
                  Ki
                </DataTableHeaderCell>
                <DataTableHeaderCell className="hidden md:table-cell">
                  Indok
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {detail.payment_events.map((ev) => {
                const isVoid = ev.event_type === 'voided'
                const isRefund = ev.event_type === 'refunded'
                const amountPrefix = isVoid || isRefund ? '−' : ''
                const prevLabel =
                  ev.event_type === 'corrected' && ev.previous_amount != null
                    ? `${formatMoneyFt(ev.previous_amount)} Ft${
                        ev.previous_payment_method_name
                          ? ` · ${ev.previous_payment_method_name}`
                          : ''
                      }`
                    : null
                return (
                  <DataTableRow
                    key={ev.id}
                    className={paymentEventRowClass(ev.event_type)}
                  >
                    <DataTableCell className="whitespace-nowrap text-hint text-ink-secondary">
                      {formatDateTime(ev.created_at)}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge
                          tone={paymentEventTone(ev.event_type)}
                          variant="soft"
                        >
                          {PAYMENT_EVENT_LABEL[ev.event_type]}
                        </StatusBadge>
                        {ev.late_settlement ? (
                          <StatusBadge tone="warning" variant="outline">
                            Késői
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-hint text-ink-muted sm:hidden">
                        {[ev.payment_method_name, ev.created_by_label]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </DataTableCell>
                    <DataTableCell align="right">
                      {ev.amount != null ? (
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            isRefund && 'text-warning-ink',
                            isVoid && 'text-ink-muted line-through'
                          )}
                        >
                          {amountPrefix}
                          {formatMoneyFt(ev.amount)} Ft
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="hidden sm:table-cell text-ink-secondary">
                      {ev.payment_method_name ?? '—'}
                    </DataTableCell>
                    <DataTableCell className="hidden md:table-cell text-hint text-ink-secondary">
                      {prevLabel ?? '—'}
                    </DataTableCell>
                    <DataTableCell className="hidden lg:table-cell text-ink-secondary">
                      {ev.created_by_label ?? '—'}
                    </DataTableCell>
                    <DataTableCell className="hidden max-w-[14rem] md:table-cell text-ink-secondary">
                      <span className="block truncate" title={ev.note ?? undefined}>
                        {ev.note ?? '—'}
                      </span>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        )}
      </div>
    </section>
  )
}
