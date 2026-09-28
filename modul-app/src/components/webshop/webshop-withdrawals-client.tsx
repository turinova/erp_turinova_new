'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setWithdrawalHandled } from '@/lib/webshop/legal-actions'
import {
  WITHDRAWALS_PAGE_SIZE,
  type AdminWithdrawalRow,
  type WithdrawalFilter
} from '@/lib/webshop/withdrawals'

const FILTERS: { value: WithdrawalFilter; label: string }[] = [
  { value: 'open', label: 'Kezelésre vár' },
  { value: 'handled', label: 'Kezelve' },
  { value: 'all', label: 'Összes' }
]

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
}

/** 14 napon belül vissza kell téríteni (45/2014. 23. §). */
function refundDeadline(iso: string): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + 14)
  return new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', dateStyle: 'medium' }).format(d)
}

function WithdrawalCard({ row, canWrite }: { row: AdminWithdrawalRow; canWrite: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle(handled: boolean) {
    startTransition(async () => {
      const result = await setWithdrawalHandled(row.id, handled)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(handled ? 'Kezeltnek jelölve.' : 'Visszatéve a kezelésre várók közé.')
      router.refresh()
    })
  }

  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-semibold text-ink">{row.orderReference}</span>
            {row.handledAt ? (
              <StatusBadge tone="success">Kezelve</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Kezelésre vár</StatusBadge>
            )}
            {row.receiptSentAt ? (
              <StatusBadge tone="neutral" variant="outline">
                Visszaigazolva e-mailben
              </StatusBadge>
            ) : (
              <StatusBadge tone="danger" variant="outline">
                Visszaigazoló e-mail nem ment ki
              </StatusBadge>
            )}
          </div>
          <p className="text-hint text-ink-secondary">
            {row.customerName} ·{' '}
            <a href={`mailto:${row.customerEmail}`} className="text-ink underline-offset-2 hover:underline">
              {row.customerEmail}
            </a>{' '}
            · {formatWhen(row.submittedAt)} · {row.reference}
          </p>
          {!row.handledAt ? (
            <p className="text-hint text-ink-secondary">Visszatérítési határidő: {refundDeadline(row.submittedAt)}</p>
          ) : null}
        </div>
        {canWrite ? (
          row.handledAt ? (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => toggle(false)}>
              Visszaállítom
            </Button>
          ) : (
            <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => toggle(true)}>
              Kezeltnek jelölöm
            </Button>
          )
        ) : null}
      </div>
      <dl className="mt-2 grid gap-x-3 gap-y-1 text-body sm:grid-cols-[180px_1fr]">
        <dt className="text-ink-secondary">Érintett termékek</dt>
        <dd className="whitespace-pre-wrap text-ink">{row.items ?? 'A teljes rendelés'}</dd>
        {row.refundAccount ? (
          <>
            <dt className="text-ink-secondary">Visszautalás</dt>
            <dd className="text-ink">{row.refundAccount}</dd>
          </>
        ) : null}
        {row.comment ? (
          <>
            <dt className="text-ink-secondary">Megjegyzés</dt>
            <dd className="whitespace-pre-wrap text-ink">{row.comment}</dd>
          </>
        ) : null}
        {!row.receiptSentAt && row.receiptError ? (
          <>
            <dt className="text-ink-secondary">E-mail hiba</dt>
            <dd className="text-danger-ink">{row.receiptError}</dd>
          </>
        ) : null}
      </dl>
    </li>
  )
}

export function WebshopWithdrawalsClient({
  rows,
  total,
  openCount,
  filter,
  page,
  canWrite
}: {
  rows: AdminWithdrawalRow[]
  total: number
  openCount: number
  filter: WithdrawalFilter
  page: number
  canWrite: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / WITHDRAWALS_PAGE_SIZE))
  const href = (f: WithdrawalFilter, p: number) => `/webshop/elallasok?szuro=${f}${p > 1 ? `&page=${p}` : ''}`

  return (
    <div className="pb-14">
      <PageHeader
        title="Elállások"
        description="A boltban online beküldött elállási nyilatkozatok. A vételárat a beérkezéstől számított 14 napon belül vissza kell téríteni."
      />

      <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Szűrés állapot szerint">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value, 1)}
            aria-current={filter === f.value ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 items-center rounded-md border px-2.5 text-hint font-medium',
              filter === f.value
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
            )}
          >
            {f.label}
            {f.value === 'open' && openCount > 0 ? ` (${openCount})` : ''}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="max-w-xl rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary" role="status">
          Nincs elállás ebben a nézetben.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <WithdrawalCard key={row.id} row={row} canWrite={canWrite} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-hint text-ink-secondary">
          <span className="tabular-nums">
            {page}. oldal / {pages} · {total} elállás
          </span>
          <div className="flex gap-1.5">
            {page > 1 ? (
              <Link
                href={href(filter, page - 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 font-medium text-ink hover:bg-subtle"
              >
                Előző
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={href(filter, page + 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 font-medium text-ink hover:bg-subtle"
              >
                Következő
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
