'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Package, Plus, Search } from 'lucide-react'
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
import { softDeleteAccessory } from '@/lib/accessories/actions'
import { formatMoneyFt } from '@/lib/accessories/parse'
import type { AccessoryListItem } from '@/lib/accessories/queries'

const LIST_PATH = '/torzsadatok/alapanyagok/termekek'

type AccessoriesClientProps = {
  initialRows: AccessoryListItem[]
  canWrite: boolean
}

export function AccessoriesClient({
  initialRows,
  canWrite
}: AccessoriesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AccessoryListItem | null>(
    null
  )
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.sku.toLowerCase().includes(term) ||
        row.manufacturer_name.toLowerCase().includes(term) ||
        (row.barcode ?? '').toLowerCase().includes(term) ||
        (row.barcode_internal ?? '').toLowerCase().includes(term)
    )
  }, [initialRows, search])

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteAccessory(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div>
      <PageHeader
        title="Termékek"
        description="Tartozékok és egyéb eladható termékek törzse (ajánlatra snapshottal)."
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => router.push(`${LIST_PATH}/uj`)}
            >
              <Plus className="size-3.5" aria-hidden />
              Új termék
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative max-w-sm"
        >
          <label className="sr-only" htmlFor="accessory-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="accessory-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, SKU, vonalkód…"
            className="pl-8"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <Package className="size-8 text-ink-secondary" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">
              {initialRows.length === 0 ? 'Még nincs termék' : 'Nincs találat'}
            </p>
            <p className="max-w-sm text-body text-ink-secondary">
              {initialRows.length === 0
                ? 'Add hozzá a gyakran eladott termékeket (pl. zsanér). Az ajánlathoz mennyiséggel veheted fel.'
                : 'Próbálj másik keresőkifejezést.'}
            </p>
          </div>
          {canWrite && initialRows.length === 0 ? (
            <Button
              type="button"
              onClick={() => router.push(`${LIST_PATH}/uj`)}
            >
              <Plus className="size-3.5" aria-hidden />
              Új termék
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>SKU</DataTableHeaderCell>
              <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Bruttó
              </DataTableHeaderCell>
              <DataTableHeaderCell>Egység</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell className="font-medium text-ink">
                  <Link
                    href={`${LIST_PATH}/${row.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {row.sku}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.manufacturer_name}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {formatMoneyFt(row.price_gross)}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.unit_shortform}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                    {row.active ? 'Aktív' : 'Inaktív'}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`${LIST_PATH}/${row.id}`)}
                    >
                      {canWrite ? 'Szerkesztés' : 'Megnyitás'}
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
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Termék törlése?"
        description={
          deleteTarget
            ? `A „${deleteTarget.name}” soft delete lesz — a meglévő ajánlatok snapshotjai megmaradnak.`
            : ''
        }
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
