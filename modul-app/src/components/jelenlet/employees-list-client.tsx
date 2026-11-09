'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CalendarDays, FileDown, Plus, Search, Users } from 'lucide-react'

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
import type { EmployeeListFilter, EmployeeListItem } from '@/lib/jelenlet/queries'
import { cn } from '@/lib/utils'

const SheetExportWizard = dynamic(
  () =>
    import('@/components/jelenlet/sheet-export-wizard').then(
      (m) => m.SheetExportWizard
    ),
  { ssr: false }
)

type Props = {
  rows: EmployeeListItem[]
  total: number
  page: number
  limit: number
  q: string
  active: EmployeeListFilter
  year: number
  month: number
  canWrite: boolean
}

const MONTH_NAMES = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December'
]

export function EmployeesListClient({
  rows,
  total,
  page,
  limit,
  q: initialQ,
  active: initialActive,
  year,
  month,
  canWrite
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  /** id → név; oldalváltáson át megmarad, a varázsló ebből listáz. */
  const [selected, setSelected] = useState<Map<string, string>>(new Map())
  const [exportOpen, setExportOpen] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id))

  function push(next: {
    q?: string
    page?: number
    active?: string
    year?: number
    month?: number
  }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const p = next.page ?? 1
    const active = next.active ?? initialActive
    const y = next.year ?? year
    const m = next.month ?? month
    if (q.trim()) params.set('q', q.trim())
    if (active && active !== 'all') params.set('active', active)
    if (p > 1) params.set('page', String(p))
    params.set('year', String(y))
    params.set('month', String(m))
    router.push(`/dolgozok?${params.toString()}`)
  }

  function toggleOne(row: EmployeeListItem) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.set(row.id, row.name)
      return next
    })
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Map(prev)
      for (const r of rows) {
        if (allSelected) next.delete(r.id)
        else next.set(r.id, r.name)
      }
      return next
    })
  }

  const selectedList = useMemo(
    () =>
      Array.from(selected, ([id, name]) => ({ id, name })).sort((a, b) =>
        a.name.localeCompare(b.name, 'hu')
      ),
    [selected]
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dolgozók"
        description={`${MONTH_NAMES[month - 1]} ${year} — hiányos napok figyelése.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/jelenlet')}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              Jelenlét naptár
            </Button>
            {selected.size > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setExportOpen(true)}
              >
                <FileDown className="size-3.5" aria-hidden />
                Jelenléti ív ({selected.size})
              </Button>
            ) : null}
            {canWrite ? (
              <Button type="button" onClick={() => router.push('/dolgozok/uj')}>
                <Plus className="size-3.5" aria-hidden />
                Új dolgozó
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') push({ q: search, page: 1 })
            }}
            placeholder="Keresés név vagy kód…"
            className="pl-8"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => push({ q: search, page: 1 })}
        >
          Keresés
        </Button>
        {(
          [
            { value: 'all', label: 'Mind' },
            { value: 'active', label: 'Aktív' },
            { value: 'inactive', label: 'Inaktív' },
            { value: 'archived', label: 'Archivált' }
          ] as const
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1.5 text-[13px]',
              initialActive === f.value
                ? 'bg-ink text-white'
                : 'bg-subtle text-ink-secondary hover:bg-border/60'
            )}
            onClick={() => push({ active: f.value, page: 1 })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle p-6">
          <div className="flex size-9 items-center justify-center rounded-md bg-surface text-ink-muted">
            <Users className="size-4" aria-hidden />
          </div>
          <div>
            {initialActive === 'archived' ? (
              <>
                <p className="text-body font-medium text-ink">Nincs archivált dolgozó.</p>
                <p className="mt-0.5 text-hint text-ink-secondary">
                  Kilépett dolgozót a dolgozó oldalán archiválhatsz — az adatai megmaradnak.
                </p>
              </>
            ) : initialQ || initialActive !== 'all' ? (
              <p className="text-body font-medium text-ink">Nincs a szűrésnek megfelelő dolgozó.</p>
            ) : (
              <>
                <p className="text-body font-medium text-ink">Még nincs dolgozó.</p>
                <p className="mt-0.5 text-hint text-ink-secondary">
                  Add hozzá az elsőt, majd töltsd a jelenléti naptárat.
                </p>
              </>
            )}
          </div>
          {canWrite && initialActive !== 'archived' ? (
            <Button type="button" onClick={() => router.push('/dolgozok/uj')}>
              <Plus className="size-3.5" aria-hidden />
              Új dolgozó
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell className="w-10">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-border"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected
                    }}
                    onChange={togglePage}
                    aria-label="Oldal kijelölése"
                  />
                </DataTableHeaderCell>
                <DataTableHeaderCell>Név</DataTableHeaderCell>
                <DataTableHeaderCell>Kód</DataTableHeaderCell>
                <DataTableHeaderCell>Típus</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>Hiányzó nap</DataTableHeaderCell>
                <DataTableHeaderCell>Hiányos nap</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%]"> </DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-border"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row)}
                      aria-label={`${row.name} kijelölése`}
                    />
                  </DataTableCell>
                  <DataTableCell
                    className={cn(
                      'font-medium',
                      row.active ? 'text-ink' : 'text-ink-secondary'
                    )}
                  >
                    {row.name}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.code || '—'}
                  </DataTableCell>
                  <DataTableCell>{row.employeeTypeName}</DataTableCell>
                  <DataTableCell>
                    {row.archivedAt ? (
                      <StatusBadge tone="neutral" variant="outline">
                        Archivált
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                        {row.active ? 'Aktív' : 'Inaktív'}
                      </StatusBadge>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    {row.emptyDays > 0 ? (
                      <span className="text-warning-ink">{row.emptyDays}</span>
                    ) : (
                      <span className="text-ink-muted">0</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    {row.incompleteDays > 0 ? (
                      <span className="text-warning-ink">
                        {row.incompleteDays}
                      </span>
                    ) : (
                      <span className="text-ink-muted">0</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/dolgozok/${row.id}`}
                      className={cn(
                        'inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle'
                      )}
                    >
                      Megnyitás
                    </Link>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <div className="flex items-center justify-between text-hint text-ink-secondary">
            <span>
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
              {selected.size > 0 ? ` · ${selected.size} kijelölve` : ''}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => push({ page: page - 1 })}
              >
                Előző
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => push({ page: page + 1 })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}

      {exportOpen ? (
        <SheetExportWizard
          open={exportOpen}
          onOpenChange={setExportOpen}
          employees={selectedList}
          onRemoveEmployee={(id) =>
            setSelected((prev) => {
              const next = new Map(prev)
              next.delete(id)
              return next
            })
          }
          year={year}
          month={month}
        />
      ) : null}
    </div>
  )
}
