'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, ShoppingCart } from 'lucide-react'

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

type Props = {
  rows: SaleListItem[]
  total: number
  page: number
  limit: number
  q: string
  pay: SalePaymentStatus | 'all'
  channel: SaleChannel | 'all'
  status: SaleStatus | 'all'
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

const PAY_FILTERS: { value: SalePaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'unpaid', label: 'Fizetetlen' },
  { value: 'partial', label: 'Részben' },
  { value: 'paid', label: 'Fizetve' }
]

const CHANNEL_FILTERS: { value: SaleChannel | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'pos', label: 'POS' },
  { value: 'manual', label: 'Manuális' },
  { value: 'webshop', label: 'Webshop' }
]

const STATUS_FILTERS: { value: SaleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'confirmed', label: 'Átadásra vár' },
  { value: 'fulfilled', label: 'Teljesítve' },
  { value: 'partially_returned', label: 'Részben visszáru' },
  { value: 'returned', label: 'Visszáru' },
  { value: 'cancelled', label: 'Törölve' }
]

function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-hint text-ink-muted">{label}</span>
      {options.map((f) => {
        const active = value === f.value
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
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
  )
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
  summary,
  canOpenSales
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function pushParams(next: {
    q?: string
    page?: number
    pay?: SalePaymentStatus | 'all'
    channel?: SaleChannel | 'all'
    status?: SaleStatus | 'all'
  }) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('tab', 'eladasok')

    const q = next.q ?? search
    const p = next.page ?? 1
    const nextPay = next.pay ?? pay
    const nextChannel = next.channel ?? channel
    const nextStatus = next.status ?? status

    if (q.trim()) sp.set('q', q.trim())
    else sp.delete('q')

    if (nextPay && nextPay !== 'all') sp.set('pay', nextPay)
    else sp.delete('pay')

    if (nextChannel && nextChannel !== 'all') sp.set('channel', nextChannel)
    else sp.delete('channel')

    if (nextStatus && nextStatus !== 'all') sp.set('status', nextStatus)
    else sp.delete('status')

    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')

    startTransition(() => {
      router.push(`?${sp.toString()}`)
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
    initialQ.trim().length > 0

  return (
    <div className="space-y-4">
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
          <div className="min-w-0 px-3 py-3">
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
          </div>
          <div className="min-w-0 px-3 py-3">
            <p className="truncate text-hint text-ink-secondary">Kifizetett</p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {formatMoneyFt(summary.paidGross)} Ft
            </p>
          </div>
          <div className="min-w-0 px-3 py-3">
            <p className="truncate text-hint text-ink-secondary">Eladások</p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {summary.saleCount}
            </p>
          </div>
        </div>
      </section>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushParams({ q: search, page: 1 })
        }}
      >
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
            placeholder="Eladásszám…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          Keresés
        </Button>
      </form>

      <div className="space-y-2">
        <FilterChips
          label="Fizetés"
          options={PAY_FILTERS}
          value={pay}
          onChange={(v) => pushParams({ pay: v, page: 1 })}
        />
        <FilterChips
          label="Csatorna"
          options={CHANNEL_FILTERS}
          value={channel}
          onChange={(v) => pushParams({ channel: v, page: 1 })}
        />
        <FilterChips
          label="Státusz"
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => pushParams({ status: v, page: 1 })}
        />
      </div>

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
                onClick={() => {
                  setSearch('')
                  pushParams({
                    q: '',
                    pay: 'all',
                    channel: 'all',
                    status: 'all',
                    page: 1
                  })
                }}
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
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
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
