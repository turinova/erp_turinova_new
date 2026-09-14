'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { FileText, ScanSearch, Search } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import { softDeleteQuote } from '@/lib/quotes/actions'
import type { QuoteListItem } from '@/lib/quotes/queries'

type QuotesListClientProps = {
  rows: QuoteListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
}

function formatUpdatedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function customerHint(row: QuoteListItem) {
  return [row.customer_email, row.customer_mobile].filter(Boolean).join(' · ')
}

export function QuotesListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ
}: QuotesListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null)
  const [pending, startTransition] = useTransition()

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

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteQuote(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.quote_number}” törölve.`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const emptySearch = useMemo(
    () => total === 0 && Boolean(initialQ),
    [total, initialQ]
  )

  return (
    <div>
      <PageHeader
        title="Árajánlatok"
        description="Mentett piszkozatok. Újat az Optiban készíthetsz."
        actions={
          <Button type="button" onClick={() => router.push('/opti')}>
            <ScanSearch className="size-3.5" aria-hidden />
            Új Optiban
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
          <label className="sr-only" htmlFor="quote-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="quote-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Keresés szám, ügyfél vagy projekt…"
            className="pl-8"
          />
        </form>
      </div>

      {total === 0 && !emptySearch ? (
        <EmptyQuotes onCreate={() => router.push('/opti')} />
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
                <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Panelek
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Bruttó
                </DataTableHeaderCell>
                <DataTableHeaderCell>Frissítve</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const hint = customerHint(row)
                return (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/ajanlatok/${row.id}`}
                          className="font-medium text-ink no-underline hover:underline"
                        >
                          {row.quote_number}
                        </Link>
                        {row.source === 'portal' &&
                        row.portal_submitted_at ? (
                          <StatusBadge tone="warning">Online</StatusBadge>
                        ) : null}
                      </div>
                      {row.project_name ? (
                        <p className="text-hint text-ink-secondary">
                          {row.project_name}
                        </p>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="min-w-0">
                        <p className="text-ink">{row.customer_name}</p>
                        {hint ? (
                          <p className="text-hint text-ink-secondary">{hint}</p>
                        ) : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums text-ink">
                      {row.panel_quantity}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums font-medium text-ink">
                      {formatQuotePrice(row.total_gross, row.currency)}
                    </DataTableCell>
                    <DataTableCell className="text-ink-secondary">
                      {formatUpdatedAt(row.updated_at)}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/ajanlatok/${row.id}`)
                          }
                        >
                          Megnyitás
                        </Button>
                        {canWrite ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-danger-ink hover:text-danger-ink"
                            onClick={() => setDeleteTarget(row)}
                          >
                            Törlés
                          </Button>
                        ) : null}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-hint text-ink-secondary">
              {from}–{to} / {total} elem
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
              <span className="px-2 text-hint text-ink-secondary">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Árajánlat törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.quote_number}” árajánlatot (${deleteTarget.customer_name})?`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyQuotes({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <FileText className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs árajánlat</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Az Optiban optimalizálj, add meg az ügyfelet, majd mentsd az
          árajánlatot.
        </p>
      </div>
      <Button type="button" onClick={onCreate}>
        <ScanSearch className="size-3.5" aria-hidden />
        Opti megnyitása
      </Button>
    </div>
  )
}
