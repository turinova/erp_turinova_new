'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { CalendarDays, FileDown, Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { EmployeeListItem } from '@/lib/jelenlet/queries'
import { cn } from '@/lib/utils'

type Props = {
  rows: EmployeeListItem[]
  total: number
  page: number
  limit: number
  q: string
  active: 'all' | 'active' | 'inactive'
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

const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({
  value: String(i + 1),
  label
}))

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [exportYear, setExportYear] = useState(String(year))
  const [exportMonth, setExportMonth] = useState(String(month))
  const [pending, startTransition] = useTransition()
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id))

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 1, y, y + 1].map((v) => ({
      value: String(v),
      label: String(v)
    }))
  }, [])

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

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const r of rows) next.delete(r.id)
      } else {
        for (const r of rows) next.add(r.id)
      }
      return next
    })
  }

  function openExport() {
    if (selected.size === 0) {
      toast.error('Válassz ki legalább egy dolgozót.')
      return
    }
    setExportYear(String(year))
    setExportMonth(String(month))
    setExportOpen(true)
  }

  function runExport() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/jelenlet/hivatalos-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeIds: ids,
            year: Number(exportYear),
            month: Number(exportMonth)
          })
        })

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(data?.error || 'PDF generálás sikertelen.')
        }

        const blob = await res.blob()
        const cd = res.headers.get('Content-Disposition') || ''
        const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(cd)
        const rawName = match?.[1] || match?.[2] || 'jelenleti-iv.pdf'
        const filename = decodeURIComponent(rawName)

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)

        toast.success(
          ids.length === 1
            ? 'Hivatalos jelenléti ív letöltve.'
            : `Hivatalos jelenléti ívek letöltve (${ids.length} dolgozó).`
        )
        setExportOpen(false)
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'PDF generálás sikertelen.'
        )
      }
    })
  }

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
              <Button type="button" variant="secondary" onClick={openExport}>
                <FileDown className="size-3.5" aria-hidden />
                Hivatalos PDF ({selected.size})
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
            { value: 'inactive', label: 'Inaktív' }
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
            <p className="text-body font-medium text-ink">Még nincs dolgozó.</p>
            <p className="mt-0.5 text-hint text-ink-secondary">
              Add hozzá az elsőt, majd töltsd a jelenléti naptárat.
            </p>
          </div>
          {canWrite ? (
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
                      onChange={() => toggleOne(row.id)}
                      aria-label={`${row.name} kijelölése`}
                    />
                  </DataTableCell>
                  <DataTableCell className="font-medium text-ink">
                    {row.name}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.code || '—'}
                  </DataTableCell>
                  <DataTableCell>{row.employeeTypeName}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                      {row.active ? 'Aktív' : 'Inaktív'}
                    </StatusBadge>
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

      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (!pending) setExportOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hivatalos jelenléti ív</DialogTitle>
            <DialogDescription>
              {selected.size} dolgozó · aláírásra alkalmas PDF
              {selected.size > 1 ? ' (ZIP)' : ''}. Céglogo a fejlécben, Turinova
              a láblécben — mint az ajánlaton.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Év" htmlFor="export-year">
              <MenuSelect
                id="export-year"
                value={exportYear}
                options={yearOptions}
                allowEmpty={false}
                onChange={setExportYear}
                disabled={pending}
              />
            </FormField>
            <FormField label="Hónap" htmlFor="export-month">
              <MenuSelect
                id="export-month"
                value={exportMonth}
                options={MONTH_OPTIONS}
                allowEmpty={false}
                onChange={setExportMonth}
                disabled={pending}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setExportOpen(false)}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={runExport}>
              <FileDown className="size-3.5" aria-hidden />
              Letöltés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
