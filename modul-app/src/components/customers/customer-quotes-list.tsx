'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Scissors, Search, X } from 'lucide-react'

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
  CustomerQuotesSummary,
  QuoteListItem,
  QuoteStatus
} from '@/lib/quotes/queries'
import {
  PAYMENT_STATUS_LABEL,
  paymentStatusTone,
  type PaymentStatus
} from '@/lib/quotes/payment-labels'
import {
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

export type CustomerQuotesPeriod = 'all' | '90d' | 'year'

type Props = {
  rows: QuoteListItem[]
  total: number
  page: number
  limit: number
  q: string
  pay: PaymentStatus | 'all'
  status: QuoteStatus | 'all'
  period: CustomerQuotesPeriod
  summary: CustomerQuotesSummary
  canOpenOpti: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

const PAY_QUICK: { value: PaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'not_paid', label: 'Nem fizetett' },
  { value: 'partial', label: 'Részben' },
  { value: 'paid', label: 'Fizetve' }
]

const STATUS_OPTIONS: { value: QuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind (aktív)' },
  { value: 'draft', label: 'Piszkozat' },
  { value: 'ordered', label: 'Megrendelve' },
  { value: 'in_production', label: 'Gyártásban' },
  { value: 'ready', label: 'Kész' },
  { value: 'finished', label: 'Lezárva' },
  { value: 'cancelled', label: 'Lemondva' }
]

const PERIOD_OPTIONS: { value: CustomerQuotesPeriod; label: string }[] = [
  { value: 'all', label: 'Teljes időszak' },
  { value: '90d', label: 'Elmúlt 90 nap' },
  { value: 'year', label: 'Idei év' }
]

const PERIOD_LABEL: Record<CustomerQuotesPeriod, string> = {
  all: 'Teljes időszak',
  '90d': 'Elmúlt 90 nap',
  year: 'Idei év'
}

export function CustomerQuotesList({
  rows,
  total,
  page,
  limit,
  q: initialQ,
  pay,
  status,
  period,
  summary,
  canOpenOpti
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
    pay?: PaymentStatus | 'all'
    status?: QuoteStatus | 'all'
    period?: CustomerQuotesPeriod
  }) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('tab', 'lapszabaszat')

    const q = next.q !== undefined ? next.q : search
    const p = next.page ?? 1
    const nextPay = next.pay ?? pay
    const nextStatus = next.status ?? status
    const nextPeriod = next.period ?? period

    if (q.trim()) sp.set('lq', q.trim())
    else sp.delete('lq')

    if (nextPay && nextPay !== 'all') sp.set('lpay', nextPay)
    else sp.delete('lpay')

    if (nextStatus && nextStatus !== 'all') sp.set('lstatus', nextStatus)
    else sp.delete('lstatus')

    if (nextPeriod && nextPeriod !== 'all') sp.set('lperiod', nextPeriod)
    else sp.delete('lperiod')

    if (p > 1) sp.set('lpage', String(p))
    else sp.delete('lpage')

    // Sales filter params stay out of the way
    sp.delete('page')
    sp.delete('q')
    sp.delete('pay')
    sp.delete('channel')
    sp.delete('status')
    sp.delete('period')

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
      status: 'all',
      period: 'all',
      page: 1
    })
  }

  const hasFilters =
    pay !== 'all' ||
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
      label: `Fizetés: ${PAYMENT_STATUS_LABEL[pay]}`,
      clear: () => pushParams({ pay: 'all', page: 1 })
    })
  }
  if (status !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Státusz: ${QUOTE_STATUS_LABEL[status]}`,
      clear: () => pushParams({ status: 'all', page: 1 })
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
            onClick={() => pushParams({ pay: 'not_paid', page: 1 })}
            className={cn(
              'min-w-0 px-3 py-3 text-left transition-colors hover:bg-subtle/80',
              pay === 'not_paid' && 'bg-subtle'
            )}
            title="Szűrés: nem fizetett"
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
          <div className="min-w-0 px-3 py-3">
            <p className="truncate text-hint text-ink-secondary">Megrendelések</p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {summary.orderCount}
            </p>
          </div>
          <button
            type="button"
            onClick={() => pushParams({ status: 'draft', page: 1 })}
            className={cn(
              'min-w-0 px-3 py-3 text-left transition-colors hover:bg-subtle/80',
              status === 'draft' && 'bg-subtle'
            )}
            title="Szűrés: piszkozat"
          >
            <p className="truncate text-hint text-ink-secondary">Piszkozatok</p>
            <p className="mt-1 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
              {summary.draftCount}
            </p>
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <label className="sr-only" htmlFor="customer-quotes-search">
            Keresés ajánlat- / megrendelésszámra
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="customer-quotes-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              }
            }}
            placeholder="Ajánlat / megrendelés / projekt…"
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
        <div className="min-w-[9.5rem] flex-1 sm:flex-none sm:w-[12rem]">
          <label
            className="mb-1 block text-hint text-ink-muted"
            htmlFor="customer-quotes-status"
          >
            Státusz
          </label>
          <MenuSelect
            id="customer-quotes-status"
            value={status}
            options={STATUS_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ status: v as QuoteStatus | 'all', page: 1 })
            }
          />
        </div>
        <div className="min-w-[9.5rem] flex-1 sm:flex-none sm:w-[11rem]">
          <label
            className="mb-1 block text-hint text-ink-muted"
            htmlFor="customer-quotes-period"
          >
            Időszak
          </label>
          <MenuSelect
            id="customer-quotes-period"
            value={period}
            options={PERIOD_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ period: v as CustomerQuotesPeriod, page: 1 })
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
          <Scissors className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">
              {hasFilters
                ? 'Nincs találat a szűrőkre'
                : 'Még nincs lapszabászat ehhez az ügyfélhez'}
            </p>
            {hasFilters ? (
              <button
                type="button"
                className="mt-1 text-body text-ink-secondary underline-offset-2 hover:underline"
                onClick={clearAllFilters}
              >
                Szűrők törlése
              </button>
            ) : canOpenOpti ? (
              <Link
                href="/opti"
                className="mt-1 inline-flex text-body font-medium text-ink underline-offset-2 hover:underline"
              >
                Új ajánlat az Optiban
              </Link>
            ) : (
              <Link
                href="/ajanlatok"
                className="mt-1 inline-flex text-body font-medium text-ink underline-offset-2 hover:underline"
              >
                Árajánlatok megnyitása
              </Link>
            )}
          </div>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Projekt</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó (Ft)</DataTableHeaderCell>
              <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="hidden md:table-cell">
                Forrás
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const primary = row.order_number
                ? `Megrendelés ${row.order_number}`
                : `Árajánlat ${row.quote_number}`
              const hint = row.order_number
                ? `Árajánlat ${row.quote_number}`
                : null
              const sourceLabel =
                row.source === 'portal'
                  ? 'Partner'
                  : row.source === 'opti'
                    ? 'Opti'
                    : row.source
              return (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/ajanlatok/${row.id}`)}
                >
                  <DataTableCell>
                    <Link
                      href={`/ajanlatok/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {primary}
                    </Link>
                    {hint ? (
                      <p className="text-hint text-ink-muted">{hint}</p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.project_name?.trim() || '—'}
                  </DataTableCell>
                  <DataTableCell className="tabular-nums text-ink-secondary">
                    {formatDate(row.updated_at)}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="font-semibold tabular-nums">
                      {formatMoneyFt(row.total_gross)} Ft
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={paymentStatusTone(row.payment_status)}
                      variant="solid"
                    >
                      {PAYMENT_STATUS_LABEL[row.payment_status]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={quoteStatusTone(row.status)}
                      variant="soft"
                    >
                      {QUOTE_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="hidden text-ink-secondary md:table-cell">
                    {sourceLabel}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
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
