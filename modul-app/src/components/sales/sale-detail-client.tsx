'use client'

import Link from 'next/link'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { SaleTotalsBreakdown } from '@/components/sales/sale-totals-breakdown'
import {
  formatMoneyFt,
  SALE_CHANNEL_LABEL,
  SALE_PAYMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  salePaymentTone,
  saleStatusTone,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import type { SaleDetail, SaleItemRow } from '@/lib/sales/queries'
import {
  isCashPaymentMethodName,
  type SaleTotalsResult
} from '@/lib/sales/totals'
import { cn } from '@/lib/utils'

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('hu-HU')
  } catch {
    return '—'
  }
}

function totalsFromDetail(detail: SaleDetail): SaleTotalsResult {
  const itemsGross = detail.items
    .filter((i) => i.item_kind === 'product')
    .reduce((s, i) => s + i.total_gross, 0)
  const feesGross = detail.items
    .filter((i) => i.item_kind === 'fee')
    .reduce((s, i) => s + i.total_gross, 0)
  const subtotalGross = itemsGross + feesGross
  const due = detail.total_gross + detail.cash_rounding_amount

  return {
    itemsGross,
    feesGross,
    subtotalGross,
    globalDiscountAmount: detail.discount_amount,
    globalDiscountPercent: detail.discount_percentage,
    subtotalNet: detail.subtotal_net,
    subtotalVat: detail.total_vat,
    totalGross: detail.total_gross,
    totalNet: detail.subtotal_net,
    totalVat: detail.total_vat,
    cashRoundingAmount: detail.cash_rounding_amount,
    due
  }
}

function lineBeforeGross(it: SaleItemRow) {
  return Math.round(it.quantity * it.unit_price_gross)
}

function channelTone(
  channel: SaleDetail['channel']
): 'info' | 'success' | 'neutral' {
  if (channel === 'pos') return 'success'
  if (channel === 'webshop') return 'info'
  return 'neutral'
}

function paymentMethodTone(
  name: string
): 'success' | 'info' | 'neutral' {
  if (isCashPaymentMethodName(name)) return 'success'
  const n = name.toLowerCase()
  if (n.includes('kártya') || n.includes('kartya') || n.includes('card')) {
    return 'info'
  }
  return 'neutral'
}

type Props = { detail: SaleDetail }

export function SaleDetailClient({ detail }: Props) {
  const totals = totalsFromDetail(detail)
  const paymentTone = salePaymentTone(
    detail.payment_status as SalePaymentStatus
  )
  const hasGlobalDisc = detail.discount_amount > 0
  const primaryPay = detail.payments[0]

  return (
    <div className="space-y-4">
      <PageHeader
        title={detail.sale_number}
        description={
          detail.customer_name
            ? `${detail.customer_name} · ${detail.warehouse_name}`
            : `Vendég · ${detail.warehouse_name}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={paymentTone}>
              {SALE_PAYMENT_STATUS_LABEL[
                detail.payment_status as SalePaymentStatus
              ] ?? detail.payment_status}
            </StatusBadge>
            <StatusBadge
              tone={saleStatusTone(detail.status as SaleStatus)}
            >
              {SALE_STATUS_LABEL[detail.status as SaleStatus] ?? detail.status}
            </StatusBadge>
          </div>
        }
      />

      {/* Pillantásra: csatorna, vevő, raktár, fizetés, kedv */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={channelTone(detail.channel)}>
          {SALE_CHANNEL_LABEL[detail.channel] ?? detail.channel}
        </StatusBadge>
        <StatusBadge tone={detail.customer_name ? 'info' : 'neutral'}>
          {detail.customer_name ?? 'Vendég'}
        </StatusBadge>
        <StatusBadge tone="neutral">{detail.warehouse_name}</StatusBadge>
        {primaryPay ? (
          <StatusBadge tone={paymentMethodTone(primaryPay.payment_method_name)}>
            {primaryPay.payment_method_name}
          </StatusBadge>
        ) : null}
        {hasGlobalDisc ? (
          <StatusBadge tone="warning">
            Kedvezmény
            {detail.discount_percentage > 0
              ? ` ${detail.discount_percentage}%`
              : ` −${formatMoneyFt(detail.discount_amount)} Ft`}
          </StatusBadge>
        ) : null}
        {detail.cash_rounding_amount !== 0 ? (
          <StatusBadge tone="neutral">Készpénz kerekítés</StatusBadge>
        ) : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div
          className={cn(
            'rounded-md border px-3 py-2.5',
            paymentTone === 'success' &&
              'border-success/35 bg-success-soft/50',
            paymentTone === 'warning' &&
              'border-warning/35 bg-warning-soft/60',
            paymentTone === 'danger' && 'border-danger/35 bg-danger-soft/50',
            paymentTone === 'neutral' && 'border-border bg-subtle'
          )}
        >
          <dt className="text-[12px] font-medium text-ink-secondary">
            Fizetendő
          </dt>
          <dd
            className={cn(
              'mt-0.5 text-[22px] font-semibold tabular-nums tracking-tight',
              paymentTone === 'success' && 'text-success-ink',
              paymentTone === 'warning' && 'text-warning-ink',
              paymentTone === 'danger' && 'text-danger-ink',
              paymentTone === 'neutral' && 'text-ink'
            )}
          >
            {formatMoneyFt(totals.due)} Ft
          </dd>
          <dd className="mt-1">
            <StatusBadge tone={paymentTone}>
              {SALE_PAYMENT_STATUS_LABEL[
                detail.payment_status as SalePaymentStatus
              ] ?? detail.payment_status}
            </StatusBadge>
          </dd>
        </div>
        <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
          <dt className="text-[12px] font-medium text-ink-secondary">Raktár</dt>
          <dd className="mt-0.5 text-body font-medium text-ink">
            {detail.warehouse_name}
          </dd>
          <dd className="mt-1 text-hint text-ink-secondary">
            {SALE_CHANNEL_LABEL[detail.channel] ?? detail.channel}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
          <dt className="text-[12px] font-medium text-ink-secondary">
            Rögzítve
          </dt>
          <dd className="mt-0.5 text-body tabular-nums text-ink">
            {formatDateTime(detail.fulfilled_at ?? detail.created_at)}
          </dd>
        </div>
      </dl>

      {detail.note ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-body text-ink-secondary">
          {detail.note}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Tétel</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Qty</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Egységár</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Kedv.</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {detail.items.map((it) => {
              const isFee = it.item_kind === 'fee'
              const before = lineBeforeGross(it)
              const hasDisc =
                it.discount_amount > 0 || it.discount_percentage > 0
              return (
                <DataTableRow
                  key={it.id}
                  className={cn(isFee && 'bg-subtle/60')}
                >
                  <DataTableCell>
                    {it.accessory_id ? (
                      <Link
                        href={`/torzsadatok/alapanyagok/termekek/${it.accessory_id}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {it.name_snapshot}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">
                        {it.name_snapshot}
                      </span>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {isFee ? (
                        <StatusBadge tone="neutral">Díj</StatusBadge>
                      ) : it.sku_snapshot ? (
                        <span className="text-hint text-ink-secondary">
                          {it.sku_snapshot}
                        </span>
                      ) : null}
                      {hasDisc ? (
                        <StatusBadge tone="warning">
                          {it.discount_percentage > 0
                            ? `−${it.discount_percentage}%`
                            : `−${formatMoneyFt(it.discount_amount)} Ft`}
                        </StatusBadge>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatQty(it.quantity)} {it.unit_shortform}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatMoneyFt(it.unit_price_gross)}
                  </DataTableCell>
                  <DataTableCell
                    align="right"
                    className={cn(
                      'tabular-nums',
                      hasDisc ? 'font-medium text-warning-ink' : 'text-ink-secondary'
                    )}
                  >
                    {hasDisc
                      ? it.discount_percentage > 0
                        ? `${it.discount_percentage}%`
                        : `−${formatMoneyFt(it.discount_amount)}`
                      : '—'}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {hasDisc ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[12px] text-ink-muted line-through">
                          {formatMoneyFt(before)}
                        </span>
                        <span className="font-semibold text-warning-ink">
                          {formatMoneyFt(it.total_gross)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold text-ink">
                        {formatMoneyFt(it.total_gross)}
                      </span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>

        <aside className="space-y-3 rounded-md border border-border bg-subtle p-3">
          <SaleTotalsBreakdown
            totals={totals}
            dueTone={paymentTone === 'neutral' ? undefined : paymentTone}
          />

          <div>
            <h3 className="mb-1.5 text-[12px] font-medium text-ink-secondary">
              Fizetések
            </h3>
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {detail.payments.map((p) => {
                const tone = paymentMethodTone(p.payment_method_name)
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-body"
                  >
                    <StatusBadge tone={tone}>
                      {p.payment_method_name}
                    </StatusBadge>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatMoneyFt(p.amount)} Ft
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>
      </div>

      <p className="text-hint text-ink-secondary">
        <Link
          href="/keszlet/mozgasok?sourceType=sale"
          className="underline-offset-2 hover:underline"
        >
          Kapcsolódó készletmozgások
        </Link>
      </p>
    </div>
  )
}
