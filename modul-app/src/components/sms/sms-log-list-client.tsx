'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare } from 'lucide-react'

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
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  smsBillableHint,
  smsSkipReasonLabel,
  smsStatusLabel,
  type SmsLogListItem
} from '@/lib/sms/log-queries'

type Props = {
  rows: SmsLogListItem[]
  total: number
  page: number
  limit: number
  year: number
  month: number
  billableCount: number
  unitPriceHuf: number
}

function statusTone(
  status: SmsLogListItem['status']
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'sent':
    case 'delivered':
      return 'success'
    case 'failed':
      return 'danger'
    case 'skipped':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function SmsLogListClient({
  rows,
  total,
  page,
  limit,
  year,
  month,
  billableCount,
  unitPriceHuf
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function pushPage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="pb-14">
      <PageHeader
        title="SMS napló"
        description={`Ebben a hónapban (${monthLabel(year, month)}) elküldött és kihagyott SMS-ek — így ellenőrizheted a számlát.`}
      />

      <p className="mb-3">
        <Link
          href="/beallitasok/elofizetes"
          className="text-hint text-ink-secondary no-underline hover:underline"
        >
          ← Vissza az előfizetéshez
        </Link>
      </p>

      <p className="mb-3 text-body text-ink-secondary">
        {smsBillableHint(billableCount, unitPriceHuf)}. A sikertelen és
        kihagyott SMS-ekért nem fizetsz.
      </p>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <MessageSquare className="size-8 text-ink-secondary" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">
              Még nincs SMS ebben a hónapban
            </p>
            <p className="max-w-sm text-body text-ink-secondary">
              Ha készre állítasz egy rendelést és az ügyfél kér SMS-t, itt
              megjelenik.
            </p>
          </div>
          <Link
            href="/beallitasok/elofizetes"
            className={buttonVariants({ variant: 'secondary' })}
          >
            Előfizetés
          </Link>
        </div>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Időpont</DataTableHeaderCell>
                <DataTableHeaderCell>Megrendelés</DataTableHeaderCell>
                <DataTableHeaderCell>Telefonszám</DataTableHeaderCell>
                <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                <DataTableHeaderCell>Megjegyzés</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const skip = smsSkipReasonLabel(row.skip_reason)
                const note =
                  row.status === 'failed'
                    ? row.error_code || 'Küldés sikertelen'
                    : skip
                return (
                  <DataTableRow key={row.id}>
                    <DataTableCell className="whitespace-nowrap tabular-nums text-ink">
                      {formatDateTime(row.created_at)}
                    </DataTableCell>
                    <DataTableCell>
                      {row.quote_id && row.order_number ? (
                        <Link
                          href={`/ajanlatok/${row.quote_id}`}
                          className="font-medium text-ink no-underline hover:underline"
                        >
                          {row.order_number}
                        </Link>
                      ) : (
                        <span className="text-ink-secondary">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-hint text-ink">
                      {row.to_display}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={statusTone(row.status)}>
                        {smsStatusLabel(row.status)}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell className="max-w-[12rem] text-hint text-ink-secondary">
                      <span className="line-clamp-2" title={note ?? undefined}>
                        {note || (row.billable ? 'Számlázható' : '—')}
                      </span>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-hint text-ink-secondary">
              {from}–{to} / {total} SMS
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushPage(page - 1)}
              >
                Előző
              </Button>
              <span className={cn('px-2 text-hint tabular-nums text-ink-secondary')}>
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => pushPage(page + 1)}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
