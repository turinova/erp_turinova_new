'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { NotebookPen, Plus, Search, X } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { moDaysAgo } from '@/lib/manual-orders/format'
import {
  MO_STATUS_LABEL,
  MO_STATUS_TONE,
  type MoItemStatus,
  type MoListRow
} from '@/lib/manual-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type Filter = MoItemStatus | 'mind'

const CHIPS: Filter[] = ['nyitott', 'megrendelve', 'megerkezett', 'atadva', 'torolve', 'mind']

type Props = {
  rows: MoListRow[]
  total: number
  page: number
  pageSize: number
  status: Filter
  q: string
  counts: Record<Filter, number>
  canWrite: boolean
  loadError: string | null
}

export function ManualOrdersListClient({
  rows,
  total,
  page,
  pageSize,
  status,
  q,
  counts,
  canWrite,
  loadError
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [qDraft, setQDraft] = useState(q)

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="space-y-3">
      <PageHeader
        title="Kézi rendelések"
        description="Beszerzés nélküli bolti rendelések — vevőnként."
        icon={NotebookPen}
        accent="blue"
        actions={
          canWrite ? (
            <Link href="/kezi-rendelesek/uj" className={buttonVariants({ size: 'sm' })}>
              <Plus className="size-3.5" aria-hidden />
              Új rendelés
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((c) => {
          const active = status === c
          return (
            <button
              key={c}
              type="button"
              disabled={pending}
              onClick={() => push({ status: c === 'nyitott' ? null : c, page: null })}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors',
                active ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink-secondary hover:bg-subtle'
              )}
            >
              {c === 'mind' ? 'Mind' : MO_STATUS_LABEL[c]}
              <span className={cn('tabular-nums text-[12px]', active ? 'text-white/80' : 'text-ink-muted')}>
                {counts[c]}
              </span>
            </button>
          )
        })}
      </div>

      <form
        role="search"
        className="relative max-w-xl"
        onSubmit={(e) => {
          e.preventDefault()
          push({ q: qDraft.trim() || null, page: null })
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          placeholder="Vevő, telefon, KR-szám… (Enter)"
          className="h-8 pl-8 pr-8"
          aria-label="Keresés a kézi rendelésekben"
        />
        {qDraft ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:bg-subtle hover:text-ink"
            aria-label="Keresés törlése"
            onClick={() => {
              setQDraft('')
              push({ q: null, page: null })
            }}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </form>

      {loadError ? (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink" role="alert">
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
          <p className="text-body text-ink-secondary">
            {q ? 'Nincs találat erre a keresésre.' : 'Nincs rendelés ebben az állapotban.'}
          </p>
          {canWrite && !q ? (
            <Link href="/kezi-rendelesek/uj" className={cn(buttonVariants({ size: 'sm' }), 'mt-3 inline-flex')}>
              Új rendelés
            </Link>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Vevő</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Tételek</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó</DataTableHeaderCell>
              <DataTableHeaderCell>Felvéve</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((r) => (
              <DataTableRow
                key={r.id}
                className="cursor-pointer hover:bg-subtle/60"
                onClick={() => router.push(`/kezi-rendelesek/${r.id}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/kezi-rendelesek/${r.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.orderNumber}
                  </Link>
                </DataTableCell>
                <DataTableCell>
                  <span className="font-medium">{r.customerName}</span>
                  {r.customerMobile ? (
                    <span className="block text-hint tabular-nums text-ink-secondary">{r.customerMobile}</span>
                  ) : null}
                </DataTableCell>
                <DataTableCell align="right">{r.itemCount}</DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={MO_STATUS_TONE[r.status]}>
                    {MO_STATUS_LABEL[r.status]}
                    {r.status !== 'megerkezett' && r.readyCount > 0
                      ? ` · ${r.readyCount}/${r.itemCount} átvehető`
                      : r.status === 'megerkezett' && r.readyCount < r.itemCount
                        ? ` ${r.readyCount}/${r.itemCount}`
                        : ''}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell align="right">{formatMoneyFt(r.totalGross)} Ft</DataTableCell>
                <DataTableCell className="text-ink-secondary">{moDaysAgo(r.createdAt)}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-secondary">
          <span>{from}–{to} / {total}</span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pending || page <= 1} onClick={() => push({ page: String(page - 1) })}>
              Előző
            </Button>
            <span className="tabular-nums">{page} / {totalPages}</span>
            <Button type="button" size="sm" variant="secondary" disabled={pending || page >= totalPages} onClick={() => push({ page: String(page + 1) })}>
              Következő
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
