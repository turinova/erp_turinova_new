'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, Undo2 } from 'lucide-react'

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
import { SaleReturnDialog } from '@/components/sales/sale-return-dialog'
import { SaleTotalsBreakdown } from '@/components/sales/sale-totals-breakdown'
import { Button } from '@/components/ui/button'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  canStartSaleReturn,
  formatMoneyFt,
  SALE_CHANNEL_LABEL,
  SALE_PAYMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  salePaymentTone,
  saleStatusTone,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import type {
  SaleCustomerSnapshot,
  SaleDetail,
  SaleItemRow
} from '@/lib/sales/queries'
import type { SaleTotalsResult } from '@/lib/sales/totals'
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

function payMethodChip(name: string): {
  tone: 'success' | 'info' | 'neutral' | 'warning'
  variant: 'solid' | 'outline'
} {
  const n = name.toLowerCase()
  if (
    n.includes('készpénz') ||
    n.includes('keszpenz') ||
    n === 'cash'
  ) {
    return { tone: 'success', variant: 'solid' }
  }
  if (n.includes('kártya') || n.includes('kartya') || n.includes('card')) {
    return { tone: 'info', variant: 'solid' }
  }
  return { tone: 'neutral', variant: 'outline' }
}

/** Fehér tartalomkártya — surface, nem subtle. */
function InfoCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <h3 className="mb-1.5 text-body font-semibold text-ink">{title}</h3>
      <div className="space-y-0.5 text-body leading-relaxed text-ink-secondary">
        {children}
      </div>
    </div>
  )
}

function hasBilling(c: SaleCustomerSnapshot) {
  return Boolean(
    c.billing_name ||
      c.billing_city ||
      c.billing_street ||
      c.billing_tax_number ||
      c.billing_postal_code
  )
}

function contactHint(c: SaleCustomerSnapshot) {
  return c.mobile || c.email || c.billing_city || null
}

type Props = {
  detail: SaleDetail
  paymentMethods: PaymentMethodOption[]
  canWrite: boolean
}

export function SaleDetailClient({
  detail,
  paymentMethods,
  canWrite
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [returnOpen, setReturnOpen] = useState(false)

  const canReturn =
    canWrite &&
    canStartSaleReturn(detail.status as SaleStatus) &&
    detail.items.some((it) => {
      const rem = it.quantity - (detail.returnedQtyByItemId[it.id] ?? 0)
      return rem > 0.0001
    })

  useEffect(() => {
    if (searchParams.get('return') === '1' && canReturn) {
      setReturnOpen(true)
      router.replace(`/ertekesitesek/${detail.id}`, { scroll: false })
    }
  }, [searchParams, canReturn, detail.id, router])

  const totals = totalsFromDetail(detail)
  const paymentTone = salePaymentTone(
    detail.payment_status as SalePaymentStatus
  )
  const primaryPay = detail.payments.find((p) => p.kind === 'payment')
  const customer = detail.customer
  const isGuest = !customer.id && !customer.name
  const customerHref = customer.id ? `/ugyfelek/${customer.id}` : null
  const secondary = contactHint(customer)

  const metaParts = [
    detail.warehouse_name,
    SALE_CHANNEL_LABEL[detail.channel] ?? detail.channel,
    detail.created_by_label ? `Eladó: ${detail.created_by_label}` : null,
    formatDateTime(detail.fulfilled_at ?? detail.created_at),
    primaryPay?.payment_method_name
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <PageHeader
        title={detail.sale_number}
        description={metaParts.join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={paymentTone} variant="solid">
              {SALE_PAYMENT_STATUS_LABEL[
                detail.payment_status as SalePaymentStatus
              ] ?? detail.payment_status}
            </StatusBadge>
            <StatusBadge
              tone={saleStatusTone(detail.status as SaleStatus)}
              variant="soft"
            >
              {SALE_STATUS_LABEL[detail.status as SaleStatus] ?? detail.status}
            </StatusBadge>
            {detail.pos_shift_id ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  router.push(`/ertekesitesek/muszakok/${detail.pos_shift_id}`)
                }
              >
                Műszak
              </Button>
            ) : null}
            {canReturn ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReturnOpen(true)}
              >
                <Undo2 className="size-3.5" aria-hidden />
                Visszáru indítása
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard title="Ügyfél">
          {isGuest ? (
            <p className="font-medium text-ink">Vendég</p>
          ) : (
            <>
              {customerHref ? (
                <Link
                  href={customerHref}
                  className="font-medium text-ink underline-offset-2 hover:underline"
                >
                  {customer.name}
                </Link>
              ) : (
                <p className="font-medium text-ink">{customer.name}</p>
              )}
              {secondary ? (
                <p>{secondary}</p>
              ) : (
                <p className="text-hint text-ink-muted">Nincs kontakt</p>
              )}
              {customer.mobile && customer.email ? (
                <p className="text-hint">{customer.email}</p>
              ) : null}
              {customerHref ? (
                <div className="pt-2">
                  <Link
                    href={customerHref}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-hint font-medium text-ink-secondary no-underline hover:bg-subtle hover:text-ink"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Ügyfél megnyitása
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </InfoCard>

        <InfoCard title="Számlázási adatok">
          {isGuest ? (
            <p className="text-hint text-ink-muted">
              Vendég eladás — nincs számlázási adat.
            </p>
          ) : hasBilling(customer) ? (
            <>
              {customer.billing_name ? (
                <p className="font-medium text-ink">{customer.billing_name}</p>
              ) : null}
              <p>
                {[customer.billing_postal_code, customer.billing_city]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>
                {[customer.billing_street, customer.billing_house_number]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              {customer.billing_country ? (
                <p>{customer.billing_country}</p>
              ) : null}
              {customer.billing_tax_number ? (
                <p>Adószám: {customer.billing_tax_number}</p>
              ) : null}
              <p className="pt-1 text-hint text-ink-muted">
                Az eladáson rögzítve — nem az élő ügyféltörzs.
              </p>
            </>
          ) : (
            <p className="text-hint text-ink-muted">
              Nincs számlázási adat ezen az eladáson.
              {customerHref ? (
                <>
                  {' '}
                  <Link
                    href={customerHref}
                    className="underline-offset-2 hover:underline"
                  >
                    Ügyfél törzs
                  </Link>
                </>
              ) : null}
            </p>
          )}
        </InfoCard>
      </div>

      {detail.note ? (
        <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-body text-ink-secondary">
          {detail.note}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Tétel</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Qty</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Bruttó egységár
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Kedv.</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Bruttó összeg
                  </DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {detail.items.map((it) => {
                  const isFee = it.item_kind === 'fee'
                  const before = lineBeforeGross(it)
                  const hasDisc =
                    it.discount_amount > 0 || it.discount_percentage > 0
                  const returned = detail.returnedQtyByItemId[it.id] ?? 0
                  return (
                    <DataTableRow key={it.id}>
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
                            <span className="text-hint text-ink-muted">Díj</span>
                          ) : it.sku_snapshot ? (
                            <span className="text-hint text-ink-secondary">
                              {it.sku_snapshot}
                            </span>
                          ) : null}
                          {hasDisc ? (
                            <StatusBadge tone="warning" variant="soft">
                              {it.discount_percentage > 0
                                ? `−${it.discount_percentage}%`
                                : `−${formatMoneyFt(it.discount_amount)} Ft`}
                            </StatusBadge>
                          ) : null}
                          {returned > 0 ? (
                            <StatusBadge tone="warning" variant="outline">
                              Vissza: {formatQty(returned)}
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
                          hasDisc
                            ? 'font-medium text-warning-ink'
                            : 'text-ink-secondary'
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
          </div>

          {detail.returns.length > 0 ? (
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-body font-semibold text-ink">Visszáruk</h3>
                <StatusBadge tone="warning" variant="soft">
                  Visszáru
                </StatusBadge>
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {detail.returns.map((ret) => (
                  <li
                    key={ret.id}
                    className="border-l-2 border-l-warning px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {ret.return_number}
                      </span>
                      <span className="font-semibold tabular-nums text-warning-ink">
                        −{formatMoneyFt(ret.refund_amount)} Ft
                      </span>
                    </div>
                    <p className="mt-0.5 text-hint text-ink-secondary">
                      {formatDateTime(ret.created_at)}
                      {ret.reason ? ` · ${ret.reason}` : ''}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {ret.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex flex-wrap items-center gap-1.5 text-body text-ink-secondary"
                        >
                          {it.item_kind === 'product' ? (
                            <StatusBadge
                              tone={it.restock ? 'success' : 'neutral'}
                              variant="outline"
                            >
                              {it.restock ? 'Készletbe' : 'Nem került készletbe'}
                            </StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral" variant="outline">
                              Díj
                            </StatusBadge>
                          )}
                          <span>
                            {it.name_snapshot} × {formatQty(it.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3 rounded-md border border-border bg-surface p-3">
          <SaleTotalsBreakdown
            totals={totals}
            dueTone={paymentTone === 'neutral' ? undefined : paymentTone}
          />

          <div>
            <h3 className="mb-1.5 text-[12px] font-medium text-ink-secondary">
              Fizetések
            </h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {detail.payments.map((p) => {
                const isRefund = p.kind === 'refund'
                const chip = isRefund
                  ? ({ tone: 'warning' as const, variant: 'soft' as const })
                  : payMethodChip(p.payment_method_name)
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-body"
                  >
                    <StatusBadge tone={chip.tone} variant={chip.variant}>
                      {isRefund
                        ? `Visszatérítés · ${p.payment_method_name}`
                        : p.payment_method_name}
                    </StatusBadge>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        isRefund ? 'text-warning-ink' : 'text-ink'
                      )}
                    >
                      {isRefund ? '−' : ''}
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
        {' · '}
        <Link
          href="/keszlet/mozgasok?sourceType=sale_return"
          className="underline-offset-2 hover:underline"
        >
          Visszáru mozgások
        </Link>
      </p>

      {canReturn ? (
        <SaleReturnDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          detail={detail}
          paymentMethods={paymentMethods}
        />
      ) : null}
    </div>
  )
}
