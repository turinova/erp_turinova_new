'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus, Search, Users } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { softDeleteCustomer } from '@/lib/customers/actions'
import type { CustomerListItem } from '@/lib/customers/queries'

type CustomersListClientProps = {
  rows: CustomerListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
}

export function CustomersListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ
}: CustomersListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(
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
      const result = await softDeleteCustomer(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const emptySearch = useMemo(
    () => total === 0 && Boolean(initialQ),
    [total, initialQ]
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ügyfelek"
        description="Kapcsolattartók és számlázási adatok."
        actions={
          canWrite ? (
            <Button type="button" onClick={() => router.push('/ugyfelek/uj')}>
              <Plus className="size-3.5" aria-hidden />
              Új ügyfél
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
          <label className="sr-only" htmlFor="customer-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="customer-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Név / e-mail / telefon / város…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      {total === 0 && !emptySearch ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <Users className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Még nincs ügyfél</p>
            <p className="mt-1 text-body text-ink-secondary">
              Add hozzá az első ügyfelet névvel és számlázási adatokkal.
            </p>
          </div>
          {canWrite ? (
            <Button type="button" onClick={() => router.push('/ugyfelek/uj')}>
              <Plus className="size-3.5" aria-hidden />
              Új ügyfél
            </Button>
          ) : null}
        </div>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs találat a keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Telefon</DataTableHeaderCell>
              <DataTableHeaderCell>E-mail</DataTableHeaderCell>
              <DataTableHeaderCell>Város</DataTableHeaderCell>
              {canWrite ? (
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              ) : null}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/ugyfelek/${row.id}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/ugyfelek/${row.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.mobile || '—'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.email || '—'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.billing_city || '—'}
                </DataTableCell>
                {canWrite ? (
                  <DataTableCell className="text-right">
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
                      Törlés
                    </Button>
                  </DataTableCell>
                ) : null}
              </DataTableRow>
            ))}
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
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
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
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Ügyfél törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” ügyfelet?`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
