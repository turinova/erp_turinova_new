'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ClipboardList, Plus, Search } from 'lucide-react'
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
import { formatMoneyFt } from '@/lib/accessories/parse'
import { cancelPurchaseOrder } from '@/lib/purchase-orders/actions'
import {
  PO_STATUS_LABEL,
  PO_STATUSES,
  poStatusTone,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import type { PurchaseOrderListItem } from '@/lib/purchase-orders/queries'

type PurchaseOrdersListClientProps = {
  rows: PurchaseOrderListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
  initialStatus: PurchaseOrderStatus | 'all'
  statusCounts: Record<PurchaseOrderStatus | 'all', number>
}

function EmptyOrders({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle p-6">
      <div className="flex size-9 items-center justify-center rounded-md bg-surface text-ink-muted">
        <ClipboardList className="size-4" aria-hidden />
      </div>
      <div>
        <p className="text-body font-medium text-ink">
          Még nincs beszállítói rendelés.
        </p>
        <p className="mt-0.5 text-hint text-ink-secondary">
          Válassz beszállítót, add hozzá a termékeket, majd jelöld megrendelve.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új rendelés
        </Button>
      ) : null}
    </div>
  )
}

export function PurchaseOrdersListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ,
  initialStatus,
  statusCounts
}: PurchaseOrdersListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderListItem | null>(
    null
  )
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
      const result = await cancelPurchaseOrder(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        deleteTarget.status === 'draft'
          ? `„${deleteTarget.po_number}” törölve.`
          : `„${deleteTarget.po_number}” visszavonva.`
      )
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const emptySearch = useMemo(
    () => total === 0 && (Boolean(initialQ) || initialStatus !== 'all'),
    [total, initialQ, initialStatus]
  )

  const chips: { key: PurchaseOrderStatus | 'all'; label: string }[] = [
    { key: 'all', label: `Összes (${statusCounts.all})` },
    ...PO_STATUSES.map((s) => ({
      key: s,
      label: `${PO_STATUS_LABEL[s]} (${statusCounts[s]})`
    }))
  ]

  return (
    <div>
      <PageHeader
        title="Beszállítói rendelések"
        description="Termék rendelés beszállítótól — vázlat, megrendelés, beérkezés."
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/beszallitoi-rendelesek/uj')}
            >
              <Plus className="size-3.5" aria-hidden />
              Új rendelés
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = initialStatus === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() =>
                pushParams({
                  status: chip.key === 'all' ? null : chip.key,
                  page: '1'
                })
              }
              className={
                active
                  ? 'rounded-md bg-ink px-2 py-1 text-label font-medium text-white'
                  : 'rounded-md border border-border bg-surface px-2 py-1 text-label text-ink-secondary hover:border-border-strong'
              }
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="mb-3">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm">
          <label className="sr-only" htmlFor="po-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="po-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Keresés szám vagy beszállító…"
            className="pl-8"
          />
        </form>
      </div>

      {total === 0 && !emptySearch ? (
        <EmptyOrders
          canWrite={canWrite}
          onCreate={() => router.push('/beszallitoi-rendelesek/uj')}
        />
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a megadott szűrésre.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Szám</DataTableHeaderCell>
                <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>Várható</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Tételek
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Nettó
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
                      href={`/beszallitoi-rendelesek/${row.id}`}
                      className="font-medium text-ink no-underline hover:underline"
                    >
                      {row.po_number}
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.supplier_name}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={poStatusTone(row.status)}>
                      {PO_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.expected_date
                      ? new Date(row.expected_date).toLocaleDateString('hu-HU')
                      : '—'}
                  </DataTableCell>
                  <DataTableCell className="text-right text-ink-secondary">
                    {row.items_count}
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums">
                    {formatMoneyFt(row.net_total)}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/beszallitoi-rendelesek/${row.id}`)
                        }
                      >
                        Megnyitás
                      </Button>
                      {canWrite &&
                      (row.status === 'draft' || row.status === 'ordered') ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-danger-ink hover:text-danger-ink"
                          onClick={() => setDeleteTarget(row)}
                        >
                          {row.status === 'draft' ? 'Törlés' : 'Visszavonás'}
                        </Button>
                      ) : null}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-hint text-ink-secondary">
              {from}–{to} / {total} elem
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    pushParams({ page: String(Math.max(1, page - 1)) })
                  }
                >
                  Előző
                </Button>
                <span className="text-hint text-ink-secondary">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() =>
                    pushParams({
                      page: String(Math.min(totalPages, page + 1))
                    })
                  }
                >
                  Következő
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title={
          deleteTarget?.status === 'draft'
            ? 'Rendelés törlése'
            : 'Rendelés visszavonása'
        }
        description={
          deleteTarget
            ? deleteTarget.status === 'draft'
              ? `Biztosan törlöd a(z) „${deleteTarget.po_number}” vázlatot?`
              : `Biztosan visszavonod a(z) „${deleteTarget.po_number}” megrendelést?`
            : ''
        }
        confirmLabel={
          deleteTarget?.status === 'draft' ? 'Törlés' : 'Visszavonás'
        }
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
