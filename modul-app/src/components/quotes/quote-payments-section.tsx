'use client'

import { Pencil, Trash2, Wallet } from 'lucide-react'

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
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import { canEditQuotePayment } from '@/lib/quotes/payment-edit'
import {
  PAYMENT_STATUS_LABEL,
  paymentStatusTone,
  quoteOverpaidGross,
  quoteRemainingGross
} from '@/lib/quotes/payment-labels'
import type {
  QuoteDetail,
  QuotePaymentEventRow,
  QuotePaymentRow
} from '@/lib/quotes/queries'
import { cn } from '@/lib/utils'

const PAYMENT_EVENT_LABEL: Record<QuotePaymentEventRow['event_type'], string> =
  {
    recorded: 'Rögzítve',
    voided: 'Érvénytelenítve',
    corrected: 'Korrekció',
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
  type: QuotePaymentEventRow['event_type']
): StatusBadgeTone {
  switch (type) {
    case 'recorded':
      return 'success'
    case 'voided':
      return 'danger'
    case 'corrected':
      return 'warning'
    default:
      return 'neutral'
  }
}

function paymentEventRowClass(type: QuotePaymentEventRow['event_type']) {
  switch (type) {
    case 'voided':
      return 'bg-danger-soft/40 opacity-80'
    case 'corrected':
      return 'border-l-2 border-l-warning bg-warning-soft/40'
    default:
      return undefined
  }
}

/** Migráció előtt: payments → szintetikus recorded sorok. */
function activityRows(detail: QuoteDetail): QuotePaymentEventRow[] {
  if (detail.payment_events.length > 0) return detail.payment_events
  return detail.payments.map((p) => ({
    id: `synth-${p.id}`,
    event_type: 'recorded' as const,
    source: 'record',
    amount: p.amount,
    payment_method_name: p.payment_method_name,
    previous_amount: null,
    previous_payment_method_name: null,
    note: p.comment,
    created_by_label: p.created_by_label,
    created_at: p.payment_date,
    quote_payment_id: p.id
  }))
}

type Props = {
  detail: QuoteDetail
  canWrite: boolean
  isPartner: boolean
  hasFinalInvoice: boolean
  canRecordPayment: boolean
  onRecordPayment: () => void
  onEditPayment: (payment: QuotePaymentRow) => void
  onVoidPayment: (payment: QuotePaymentRow) => void
  recordLoading?: boolean
}

export function QuotePaymentsSection({
  detail,
  canWrite,
  isPartner,
  hasFinalInvoice,
  canRecordPayment,
  onRecordPayment,
  onEditPayment,
  onVoidPayment,
  recordLoading = false
}: Props) {
  const amountDue = detail.final_total_gross
  const remaining = quoteRemainingGross(amountDue, detail.total_paid)
  const overpaid = quoteOverpaidGross(amountDue, detail.total_paid)
  const tone = paymentStatusTone(detail.payment_status)
  const editable = canEditQuotePayment({
    canWrite,
    isPartner,
    quoteStatus: detail.status,
    hasOrderNumber: Boolean(detail.order_number),
    hasFinalInvoice
  })
  const events = activityRows(detail)

  return (
    <section
      id="fizetesek"
      className="scroll-mt-16 space-y-3 rounded-md border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-body font-semibold text-ink">Befizetések</h2>
            <StatusBadge tone={tone} variant="soft">
              {PAYMENT_STATUS_LABEL[detail.payment_status]}
            </StatusBadge>
          </div>
          <p className="text-hint text-ink-secondary">
            {detail.payments.length > 0 ? (
              <>
                Fizetve{' '}
                <span className="font-medium tabular-nums text-ink">
                  {formatQuotePrice(detail.total_paid, detail.currency)}
                </span>
                {remaining > 0 ? (
                  <>
                    {' · '}Hátralék{' '}
                    <span className="font-medium tabular-nums text-warning-ink">
                      {formatQuotePrice(remaining, detail.currency)}
                    </span>
                  </>
                ) : null}
                {overpaid > 0 ? (
                  <>
                    {' · '}Túlfizetés{' '}
                    <span className="font-medium tabular-nums text-warning-ink">
                      {formatQuotePrice(overpaid, detail.currency)}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              'Még nincs érvényes befizetés'
            )}
          </p>
        </div>
        {canRecordPayment ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={recordLoading}
            loading={recordLoading}
            onClick={onRecordPayment}
          >
            <Wallet className="size-3.5" aria-hidden />
            Befizetés rögzítése
          </Button>
        ) : null}
      </div>

      {detail.payments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-hint text-ink-secondary">
          Még nincs rögzített befizetés
          {canRecordPayment
            ? ' — használd a Befizetés rögzítése gombot.'
            : '.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {detail.payments.map((p) => {
            const chip = payMethodChip(p.payment_method_name)
            return (
              <li
                key={p.id}
                className="flex max-w-full items-center gap-1 rounded-md border border-border bg-subtle/60 py-1 pl-2 pr-1"
              >
                <div className="min-w-0 px-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={chip.tone} variant={chip.variant}>
                      {p.payment_method_name}
                    </StatusBadge>
                    <span className="text-body font-semibold tabular-nums text-ink">
                      {formatQuotePrice(p.amount, detail.currency)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                    {[p.created_by_label, formatDateTime(p.payment_date)]
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
                      aria-label="Befizetés korrekciója"
                      onClick={() => onEditPayment(p)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-danger-ink hover:text-danger-ink"
                      aria-label="Befizetés érvénytelenítése"
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
        {events.length === 0 ? (
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
              {events.map((ev) => {
                const isVoid = ev.event_type === 'voided'
                const prevLabel =
                  ev.event_type === 'corrected' && ev.previous_amount != null
                    ? `${formatQuotePrice(ev.previous_amount, detail.currency)}${
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
                      <StatusBadge
                        tone={paymentEventTone(ev.event_type)}
                        variant="soft"
                      >
                        {PAYMENT_EVENT_LABEL[ev.event_type]}
                      </StatusBadge>
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
                            isVoid && 'text-ink-muted line-through'
                          )}
                        >
                          {isVoid ? '−' : ''}
                          {formatQuotePrice(ev.amount, detail.currency)}
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
                      <span
                        className="block truncate"
                        title={ev.note ?? undefined}
                      >
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
