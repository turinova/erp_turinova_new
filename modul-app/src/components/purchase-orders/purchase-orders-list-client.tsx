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
import { cn } from '@/lib/utils'

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

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
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
    { key: 'all', label: `Mind (${statusCounts.all})` },
    ...PO_STATUSES.map((s) => ({
      key: s,
      label: `${PO_STATUS_LABEL[s]} (${statusCounts[s]})`
    }))
  ]

  return (
    <div className="space-y-4">
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

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushParams({ q: qDraft.trim() || null, page: '1' })
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
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
            placeholder="Szám / beszállító…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
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
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {total === 0 && !emptySearch ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ClipboardList className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">
              Még nincs beszállítói rendelés
            </p>
            <p className="mt-1 text-body text-ink-secondary">
              Válassz beszállítót, add hozzá a termékeket, majd jelöld
              megrendelve.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/beszallitoi-rendelesek/uj')}
            >
              <Plus className="size-3.5" aria-hidden />
              Új rendelés
            </Button>
          ) : null}
        </div>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs találat a szűrőkkel.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
              <DataTableHeaderCell>Státusz</DataTableHeaderCell>
              <DataTableHeaderCell>Várható</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Tételek</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Nettó</DataTableHeaderCell>
              {canWrite ? (
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              ) : null}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const canCancel =
                canWrite &&
                (row.status === 'draft' || row.status === 'ordered')
              return (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/beszallitoi-rendelesek/${row.id}`)
                  }
                >
                  <DataTableCell>
                    <Link
                      href={`/beszallitoi-rendelesek/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
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
                  <DataTableCell className="tabular-nums text-ink-secondary">
                    {formatDate(row.expected_date)}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="tabular-nums">{row.items_count}</span>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="tabular-nums font-medium">
                      {formatMoneyFt(row.net_total)}
                    </span>
                  </DataTableCell>
                  {canWrite ? (
                    <DataTableCell className="text-right">
                      {canCancel ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-danger-ink hover:text-danger-ink"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(row)
                          }}
                        >
                          {row.status === 'draft' ? 'Törlés' : 'Visszavonás'}
                        </Button>
                      ) : (
                        <span className="text-hint text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                  ) : null}
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span>
            {from}–{to} / {total}
          </span>
          {totalPages > 1 ? (
            <div className="flex gap-1">
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
      ) : null}

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
