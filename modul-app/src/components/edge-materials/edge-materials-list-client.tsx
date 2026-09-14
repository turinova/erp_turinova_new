'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus, Search, SquareStack } from 'lucide-react'
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
import { Select } from '@/components/ui/select'
import { softDeleteEdgeMaterial } from '@/lib/edge-materials/actions'
import {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet
} from '@/lib/edge-materials/parse'
import type { EdgeMaterialListItem } from '@/lib/edge-materials/queries'

type EdgeMaterialsListClientProps = {
  rows: EdgeMaterialListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
  initialActive: 'all' | 'active' | 'inactive'
}

export function EdgeMaterialsListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ,
  initialActive
}: EdgeMaterialsListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [deleteTarget, setDeleteTarget] = useState<EdgeMaterialListItem | null>(
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
      const result = await softDeleteEdgeMaterial(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        `„${deleteTarget.decor} / ${deleteTarget.type}” törölve.`
      )
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const emptySearch = useMemo(
    () => total === 0 && (initialQ || initialActive !== 'all'),
    [total, initialQ, initialActive]
  )

  return (
    <div>
      <PageHeader
        title="Élzárók"
        description="Élzáró anyagok a gyártáshoz és optimalizáláshoz."
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() =>
                router.push('/torzsadatok/alapanyagok/elzarok/uj')
              }
            >
              <Plus className="size-3.5" aria-hidden />
              Új élzáró
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
          <label className="sr-only" htmlFor="edge-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="edge-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Keresés típus, dekor, gépkód…"
            className="pl-8"
          />
        </form>

        <div className="w-full sm:w-44">
          <label className="sr-only" htmlFor="edge-active-filter">
            Állapot szűrő
          </label>
          <Select
            id="edge-active-filter"
            value={initialActive}
            onChange={(e) =>
              pushParams({
                active: e.target.value === 'all' ? null : e.target.value,
                page: '1'
              })
            }
          >
            <option value="all">Összes állapot</option>
            <option value="active">Csak aktív</option>
            <option value="inactive">Csak inaktív</option>
          </Select>
        </div>
      </div>

      {total === 0 && !emptySearch ? (
        <EmptyEdges
          canWrite={canWrite}
          onCreate={() =>
            router.push('/torzsadatok/alapanyagok/elzarok/uj')
          }
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
                <DataTableHeaderCell>Dekor</DataTableHeaderCell>
                <DataTableHeaderCell>Típus</DataTableHeaderCell>
                <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
                <DataTableHeaderCell>Méret</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Bruttó ár
                </DataTableHeaderCell>
                <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const gross = grossFromNet(row.price_net, row.tax_rate_percent)
                return (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <Link
                        href={`/torzsadatok/alapanyagok/elzarok/${row.id}`}
                        className="font-medium text-ink no-underline hover:underline"
                      >
                        {row.decor}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{row.type}</DataTableCell>
                    <DataTableCell>{row.manufacturer_name}</DataTableCell>
                    <DataTableCell className="tabular-nums text-ink-secondary">
                      {formatHuNumber(row.width_mm)} ×{' '}
                      {formatHuNumber(row.thickness_mm)} mm
                    </DataTableCell>
                    <DataTableCell align="right">
                      {formatMoneyFt(gross)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={row.active ? 'active' : 'neutral'}>
                        {row.active ? 'Aktív' : 'Inaktív'}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/torzsadatok/alapanyagok/elzarok/${row.id}`
                            )
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
        title="Élzáró törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.decor} / ${deleteTarget.type}” élzárót?`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyEdges({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <SquareStack className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs élzáró</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá az ABS / PVC élzárókat mérettel, árral és gépkóddal.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új élzáró
        </Button>
      ) : null}
    </div>
  )
}
