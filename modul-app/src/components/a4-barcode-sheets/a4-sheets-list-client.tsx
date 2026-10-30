'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { LayoutGrid, Plus, Search, Trash2 } from 'lucide-react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { softDeleteA4BarcodeSheet } from '@/lib/a4-barcode-sheets/actions'
import type { A4SheetListItem } from '@/lib/a4-barcode-sheets/queries'
import { A4_PAGE_KEY } from '@/lib/a4-barcode-sheets/types'
import { cn } from '@/lib/utils'

type Props = {
  initialRows: A4SheetListItem[]
  canWrite: boolean
}

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export function A4SheetsListClient({ initialRows, canWrite }: Props) {
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<A4SheetListItem | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter((r) => r.name.toLowerCase().includes(term))
  }, [initialRows, search])

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      const res = await softDeleteA4BarcodeSheet(id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success('Lap törölve.')
      setDeleteTarget(null)
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vonalkód lap"
        description="A4 rács termékvonalkódokkal — irodai nyomtató, menthető sablon."
        icon={LayoutGrid}
        actions={
          canWrite ? (
            <Link
              href={`${A4_PAGE_KEY}/uj`}
              className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}
            >
              <Plus className="size-4" aria-hidden />
              Új lap
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-tertiary"
            aria-hidden
          />
          <label className="sr-only" htmlFor="a4-sheet-search">
            Keresés név szerint
          </label>
          <Input
            id="a4-sheet-search"
            className="h-8 pl-8"
            placeholder="Keresés név szerint…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-3 py-6 text-center text-body text-ink-secondary">
          {initialRows.length === 0
            ? 'Még nincs vonalkód lap. Hozz létre egyet a füzethez vagy a falra.'
            : 'Nincs találat a keresésre.'}
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Rács</DataTableHeaderCell>
              <DataTableHeaderCell>Kitöltött</DataTableHeaderCell>
              <DataTableHeaderCell>Módosítva</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  <Link
                    href={`${A4_PAGE_KEY}/${row.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {row.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {row.cols} × {row.rows}
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {row.cell_count} / {row.cols * row.rows}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {formatUpdated(row.updated_at)}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`${A4_PAGE_KEY}/${row.id}`}
                      className={cn(
                        buttonVariants({ variant: 'secondary', size: 'sm' }),
                        'no-underline'
                      )}
                    >
                      Megnyitás
                    </Link>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => setDeleteTarget(row)}
                        aria-label={`${row.name} törlése`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
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
          if (!open) setDeleteTarget(null)
        }}
        title="Lap törlése?"
        description={
          deleteTarget
            ? `A „${deleteTarget.name}” sablon törlődik. A kinyomtatott PDF-ek megmaradnak.`
            : ''
        }
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
