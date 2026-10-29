'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Search, ShoppingCart, X } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type {
  CustomerSalesSummary,
  SaleListItem
} from '@/lib/sales/queries'
import {
  formatMoneyFt,
  SALE_CHANNEL_LABEL,
  SALE_PAYMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  salePaymentTone,
  saleStatusTone,
  type SaleChannel,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

export type CustomerSalesPeriod = 'all' | '90d' | 'year'

type Props = {
  rows: SaleListItem[]
  total: number
  page: number
  limit: number
  q: string
  pay: SalePaymentStatus | 'all'
  channel: SaleChannel | 'all'
  status: SaleStatus | 'all'
  period: CustomerSalesPeriod
  summary: CustomerSalesSummary
  canOpenSales: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

const PAY_QUICK: { value: SalePaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'unpaid', label: 'Fizetetlen' },
  { value: 'partial', label: 'Részben' },
  { value: 'paid', label: 'Fizetve' }
]

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Mind' },
  { value: 'pos', label: 'POS' },
  { value: 'manual', label: 'Manuális' },
  { value: 'webshop', label: 'Webshop' }
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Mind (aktív)' },
  { value: 'confirmed', label: 'Átadásra vár' },
  { value: 'fulfilled', label: 'Teljesítve' },
  { value: 'partially_returned', label: 'Részben visszáru' },
  { value: 'returned', label: 'Visszáru' },
  { value: 'cancelled', label: 'Lemondva' }
]

const PERIOD_OPTIONS: { value: CustomerSalesPeriod; label: string }[] = [
  { value: 'all', label: 'Teljes időszak' },
  { value: '90d', label: 'Elmúlt 90 nap' },
  { value: 'year', label: 'Idei év' }
]

const PERIOD_LABEL: Record<CustomerSalesPeriod, string> = {
  all: 'Teljes időszak',
  '90d': 'Elmúlt 90 nap',
  year: 'Idei év'
}

export function CustomerSalesList({
  rows,
  total,
  page,
  limit,
  q: initialQ,
  pay,
  channel,
  status,
  period,
  summary,
  canOpenSales
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  function pushParams(next: {
    q?: string
    page?: number
    pay?: SalePaymentStatus | 'all'
    channel?: SaleChannel | 'all'
    status?: SaleStatus | 'all'
    period?: CustomerSalesPeriod
  }) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('tab', 'eladasok')

    const q = next.q !== undefined ? next.q : search
    const p = next.page ?? 1
    const nextPay = next.pay ?? pay
    const nextChannel = next.channel ?? channel
    const nextStatus = next.status ?? status
    const nextPeriod = next.period ?? period

    if (q.trim()) sp.set('q', q.trim())
    else sp.delete('q')

    if (nextPay && nextPay !== 'all') sp.set('pay', nextPay)
    else sp.delete('pay')

    if (nextChannel && nextChannel !== 'all') sp.set('channel', nextChannel)
    else sp.delete('channel')

    if (nextStatus && nextStatus !== 'all') sp.set('status', nextStatus)
    else sp.delete('status')

    if (nextPeriod && nextPeriod !== 'all') sp.set('period', nextPeriod)
    else sp.delete('period')

    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')

    startTransition(() => {
      router.push(`?${sp.toString()}`)
    })
  }

  useEffect(() => {
    if (search === initialQ) return
    const t = window.setTimeout(() => {
      pushParams({ q: search, page: 1 })
    }, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on search text
  }, [search])

  function clearAllFilters() {
    setSearch('')
    pushParams({
      q: '',
      pay: 'all',
      channel: 'all',
      status: 'all',
      period: 'all',
      page: 1
    })
  }

  if (!canOpenSales) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-4 text-body text-ink-muted">
        Nincs jogod az értékesítések megtekintéséhez.
      </p>
    )
  }

  const hasFilters =
    pay !== 'all' ||
    channel !== 'all' ||
    status !== 'all' ||
    period !== 'all' ||
    initialQ.trim().length > 0

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (initialQ.trim()) {
    activeChips.push({
      key: 'q',
      label: `Keresés: ${initialQ.trim()}`,
      clear: () => {
        setSearch('')
        pushParams({ q: '', page: 1 })
      }
    })
  }
  if (pay !== 'all') {
    activeChips.push({
      key: 'pay',
      label: `Fizetés: ${SALE_PAYMENT_STATUS_LABEL[pay] ?? pay}`,
      clear: () => pushParams({ pay: 'all', page: 1 })
    })
  }
  if (status !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Státusz: ${SALE_STATUS_LABEL[status] ?? status}`,
      clear: () => pushParams({ status: 'all', page: 1 })
    })
  }
  if (channel !== 'all') {
    activeChips.push({
      key: 'channel',
      label: `Csatorna: ${SALE_CHANNEL_LABEL[channel] ?? channel}`,
      clear: () => pushParams({ channel: 'all', page: 1 })
    })
  }
  if (period !== 'all') {
    activeChips.push({
      key: 'period',
      label: `Időszak: ${PERIOD_LABEL[period]}`,
      clear: () => pushParams({ period: 'all', page: 1 })
    })
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-border bg-surface">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <div className="min-w-0 px-3 py-3">
            <p className="truncate text-hint text-ink-secondary">
              Összes bruttó
            </p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {formatMoneyFt(summary.totalGross)} Ft
            </p>
          </div>
          <button
            type="button"
            onClick={() => pushParams({ pay: 'unpaid', page: 1 })}
            className={cn(
              'min-w-0 px-3 py-3 text-left transition-colors hover:bg-subtle/80',
              pay === 'unpaid' && 'bg-subtle'
            )}
            title="Szűrés: fizetetlen"
          >
            <p className="truncate text-hint text-ink-secondary">
              Nyitott tartozás
            </p>
            <p
              className={cn(
                'mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight',
                summary.openDue > 0 ? 'text-warning-ink' : 'text-ink'
              )}
            >
              {formatMoneyFt(summary.openDue)} Ft
            </p>
          </button>
          <button
            type="button"
            onClick={() => pushParams({ pay: 'paid', page: 1 })}
            className={cn(
              'min-w-0 px-3 py-3 text-left transition-colors hover:bg-subtle/80',
              pay === 'paid' && 'bg-subtle'
            )}
            title="Szűrés: fizetve"
          >
            <p className="truncate text-hint text-ink-secondary">Kifizetett</p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {formatMoneyFt(summary.paidGross)} Ft
            </p>
          </button>
          <div className="min-w-0 px-3 py-3">
            <p className="truncate text-hint text-ink-secondary">Eladások</p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {summary.saleCount}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <label className="sr-only" htmlFor="customer-sales-search">
            Keresés eladásszámra
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="customer-sales-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              }
            }}
            placeholder="Eladásszám…"
            className="pl-8"
          />
        </div>
        <p className="shrink-0 text-hint tabular-nums text-ink-muted">
          {rangeStart}–{rangeEnd} / {total}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-hint text-ink-muted">Fizetés</span>
        {PAY_QUICK.map((f) => {
          const active = pay === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => pushParams({ pay: f.value, page: 1 })}
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[9.5rem] flex-1 sm:flex-none sm:w-[11rem]">
          <label
            className="mb-1 block text-hint text-ink-muted"
            htmlFor="customer-sales-status"
          >
            Státusz
          </label>
          <MenuSelect
            id="customer-sales-status"
            value={status}
            options={STATUS_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ status: v as SaleStatus | 'all', page: 1 })
            }
          />
        </div>
        <div className="min-w-[9.5rem] flex-1 sm:flex-none sm:w-[10rem]">
          <label
            className="mb-1 block text-hint text-ink-muted"
            htmlFor="customer-sales-channel"
          >
            Csatorna
          </label>
          <MenuSelect
            id="customer-sales-channel"
            value={channel}
            options={CHANNEL_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ channel: v as SaleChannel | 'all', page: 1 })
            }
          />
        </div>
        <div className="min-w-[9.5rem] flex-1 sm:flex-none sm:w-[11rem]">
          <label
            className="mb-1 block text-hint text-ink-muted"
            htmlFor="customer-sales-period"
          >
            Időszak
          </label>
          <MenuSelect
            id="customer-sales-period"
            value={period}
            options={PERIOD_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ period: v as CustomerSalesPeriod, page: 1 })
            }
          />
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-border bg-surface px-2 text-hint text-ink-secondary transition-colors hover:border-ink/20 hover:text-ink"
              aria-label={`${chip.label} szűrő törlése`}
            >
              <span className="truncate">{chip.label}</span>
              <X className="size-3 shrink-0" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-7 px-1.5 text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            Összes törlése
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ShoppingCart className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">
              {hasFilters
                ? 'Nincs találat a szűrőkre'
                : 'Még nincs értékesítés ehhez az ügyfélhez'}
            </p>
            {hasFilters ? (
              <button
                type="button"
                className="mt-1 text-body text-ink-secondary underline-offset-2 hover:underline"
                onClick={clearAllFilters}
              >
                Szűrők törlése
              </button>
            ) : (
              <Link
                href="/pos"
                className="mt-1 inline-flex text-body font-medium text-ink underline-offset-2 hover:underline"
              >
                POS megnyitása
              </Link>
            )}
          </div>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
              <DataTableHeaderCell>Csatorna</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó (Ft)</DataTableHeaderCell>
              <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="hidden md:table-cell">
                Raktár
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/ertekesitesek/${row.id}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/ertekesitesek/${row.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.sale_number}
                  </Link>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.fulfilled_at ?? row.created_at)}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {SALE_CHANNEL_LABEL[row.channel as SaleChannel] ??
                    row.channel}
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-semibold tabular-nums">
                    {formatMoneyFt(row.total_gross)} Ft
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={salePaymentTone(
                      row.payment_status as SalePaymentStatus
                    )}
                    variant="solid"
                  >
                    {SALE_PAYMENT_STATUS_LABEL[
                      row.payment_status as SalePaymentStatus
                    ] ?? row.payment_status}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={saleStatusTone(row.status as SaleStatus)}
                    variant="soft"
                  >
                    {SALE_STATUS_LABEL[row.status as SaleStatus] ?? row.status}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="hidden text-ink-secondary md:table-cell">
                  {row.warehouse_name}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span className="tabular-nums">
            {rangeStart}–{rangeEnd} / {total}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="secondary"
              disabled={pending || page <= 1}
              onClick={() => pushParams({ page: page - 1 })}
            >
              Előző
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || page >= totalPages}
              onClick={() => pushParams({ page: page + 1 })}
            >
              Következő
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
