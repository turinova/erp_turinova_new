'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ClipboardList, FileText, ScanSearch, Search } from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH
} from '@/lib/auth/surface'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PartnerQuoteListItem } from '@/lib/partner/quotes-queries'
import {
  PAYMENT_STATUS_LABEL,
  paymentStatusTone
} from '@/lib/quotes/payment-labels'
import {
  partnerQuoteStatusLabel,
  partnerQuoteStatusTone
} from '@/lib/quotes/partner-status-labels'

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

function formatDateOnly(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

type Mode = 'drafts' | 'submitted'

export function PartnerQuotesListClient({
  mode,
  rows,
  total,
  page,
  limit,
  initialQ
}: {
  mode: Mode
  rows: PartnerQuoteListItem[]
  total: number
  page: number
  limit: number
  initialQ: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)

  const isDrafts = mode === 'drafts'
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: qDraft.trim() || null, page: '1' })
  }

  function detailHref(row: PartnerQuoteListItem) {
    return isDrafts
      ? `${PARTNER_QUOTES_PATH}/${row.id}`
      : `${PARTNER_ORDERS_PATH}/${row.id}`
  }

  const emptySearch = useMemo(
    () => total === 0 && Boolean(initialQ),
    [total, initialQ]
  )

  return (
    <div>
      <PageHeader
        title={isDrafts ? 'Ajánlatok' : 'Megrendelések'}
        description={
          isDrafts
            ? 'Mentett, még be nem küldött ajánlataid. Nyisd meg a részleteket a beküldéshez.'
            : 'Beküldött ajánlataid — státusz, fizetés és gyártás dátuma a cégnél.'
        }
        icon={isDrafts ? FileText : ClipboardList}
        actions={
          isDrafts ? (
            <Button type="button" onClick={() => router.push(PARTNER_OPTI_PATH)}>
              <ScanSearch className="size-3.5" aria-hidden />
              Új Optiban
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
          <label className="sr-only" htmlFor="partner-quote-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="partner-quote-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder={
              isDrafts
                ? 'Keresés ajánlatszám, projekt…'
                : 'Keresés ajánlat-, rendelésszám, projekt…'
            }
            className="pl-8"
          />
        </form>
      </div>

      {total === 0 && !emptySearch ? (
        <div className="rounded-md border border-dashed border-border bg-subtle p-4">
          <p className="text-body font-medium text-ink">
            {isDrafts
              ? 'Még nincs mentett ajánlatod.'
              : 'Még nincs beküldött rendelésed.'}
          </p>
          <p className="mt-1 text-body text-ink-secondary">
            {isDrafts
              ? 'Készíts egyet az Optiban, majd a részleteknél küldd be a cégnek.'
              : 'Az Ajánlatok listáról tudsz beküldeni.'}
          </p>
          {isDrafts ? (
            <Button
              type="button"
              className="mt-3"
              onClick={() => router.push(PARTNER_OPTI_PATH)}
            >
              Opti megnyitása
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => router.push(PARTNER_QUOTES_PATH)}
            >
              Ajánlatok
            </Button>
          )}
        </div>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a megadott keresésre.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Szám</DataTableHeaderCell>
                <DataTableHeaderCell>Cég</DataTableHeaderCell>
                {!isDrafts ? (
                  <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
                ) : null}
                {!isDrafts ? (
                  <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell className="text-right">
                  Panelek
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Bruttó
                </DataTableHeaderCell>
                {!isDrafts ? (
                  <DataTableHeaderCell>Gyártás</DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell>
                  {isDrafts ? 'Frissítve' : 'Beküldve'}
                </DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <Link
                      href={detailHref(row)}
                      className="font-medium text-ink no-underline hover:underline"
                    >
                      {isDrafts
                        ? row.quote_number
                        : (row.order_number ?? row.quote_number)}
                    </Link>
                    {!isDrafts && row.order_number ? (
                      <p className="text-hint text-ink-secondary">
                        {row.quote_number}
                      </p>
                    ) : null}
                    {row.project_name ? (
                      <p className="text-hint text-ink-secondary">
                        {row.project_name}
                      </p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-ink">
                      {row.company_name ?? '—'}
                    </span>
                  </DataTableCell>
                  {!isDrafts ? (
                    <DataTableCell>
                      <StatusBadge
                        tone={paymentStatusTone(row.payment_status)}
                      >
                        {PAYMENT_STATUS_LABEL[row.payment_status]}
                      </StatusBadge>
                    </DataTableCell>
                  ) : null}
                  {!isDrafts ? (
                    <DataTableCell>
                      <StatusBadge
                        tone={partnerQuoteStatusTone(row.status)}
                      >
                        {partnerQuoteStatusLabel(row.status)}
                      </StatusBadge>
                    </DataTableCell>
                  ) : null}
                  <DataTableCell className="text-right tabular-nums text-ink">
                    {row.panel_quantity}
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums text-ink">
                    {formatQuotePrice(row.total_gross, row.currency)}
                  </DataTableCell>
                  {!isDrafts ? (
                    <DataTableCell className="text-ink">
                      {row.production_date
                        ? formatDateOnly(row.production_date)
                        : '—'}
                    </DataTableCell>
                  ) : null}
                  <DataTableCell className="text-hint text-ink-secondary">
                    {formatDateTime(
                      isDrafts
                        ? row.updated_at
                        : (row.portal_submitted_at ?? row.updated_at)
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(detailHref(row))}
                    >
                      Megnyitás
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-hint text-ink-secondary">
            <p>
              {from}–{to} / {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
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
