import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { orderStatusHint } from '@/lib/partner/order-status-copy'
import type { PartnerQuoteListItem } from '@/lib/partner/quotes-queries'
import {
  partnerQuoteStatusLabel,
  partnerQuoteStatusTone
} from '@/lib/quotes/partner-status-labels'
import { cn } from '@/lib/utils'

export function RecentOrdersCard({
  rows,
  total,
  ordersHref,
  selectedTenantId
}: {
  /** null = betöltési hiba. */
  rows: PartnerQuoteListItem[] | null
  total: number
  ordersHref: string
  selectedTenantId: string | null
}) {
  return (
    <section
      aria-labelledby="home-recent-orders"
      className="rounded-lg border border-border bg-surface"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <h2
          id="home-recent-orders"
          className="text-[17px] font-semibold text-ink"
        >
          Legutóbbi rendeléseim
        </h2>
        {total > 0 ? (
          <Link
            href={ordersHref}
            className="inline-flex items-center gap-1 text-[15px] font-medium text-ink no-underline hover:underline"
          >
            Összes ({total})
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      {rows === null ? (
        <p className="px-5 py-4 text-[15px] text-danger-ink" role="alert">
          Nem sikerült betölteni a rendeléseket — frissítsd az oldalt.
        </p>
      ) : rows.length === 0 ? (
        <div className="px-5 py-5">
          <p className="text-[15px] font-medium text-ink">
            Még nincs leadott rendelésed.
          </p>
          <p className="mt-1 text-[15px] text-ink-secondary">
            Az első rendelés 3 lépés —{' '}
            <a href="#hogyan-mukodik" className="text-ink underline">
              nézd meg, hogyan működik
            </a>
            .
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const number = row.order_number ?? row.quote_number
            const otherCompany =
              selectedTenantId != null && row.tenant_id !== selectedTenantId
            return (
              <li key={row.id}>
                <Link
                  href={`${ordersHref}/${row.id}`}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 no-underline transition-colors hover:bg-subtle sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]',
                    row.status === 'cancelled' && 'opacity-60'
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-[16px] font-semibold text-ink"
                      title={row.project_name ?? undefined}
                    >
                      {row.project_name ?? number}
                    </p>
                    <p className="text-[13.5px] tabular-nums text-ink-muted">
                      {row.project_name ? number : 'Nincs projektnév'}
                      {otherCompany && row.company_name
                        ? ` · ${row.company_name}`
                        : ''}
                    </p>
                  </div>
                  <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:col-span-1 sm:row-start-auto">
                    <StatusBadge
                      tone={partnerQuoteStatusTone(row.status)}
                      variant={row.status === 'ready' ? 'solid' : 'soft'}
                      className="text-[13.5px]"
                    >
                      {partnerQuoteStatusLabel(row.status)}
                    </StatusBadge>
                    <span className="text-[14px] text-ink-secondary">
                      {orderStatusHint(row)}
                    </span>
                  </div>
                  <ChevronRight
                    className="size-5 text-ink-muted sm:col-start-3"
                    aria-hidden
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
