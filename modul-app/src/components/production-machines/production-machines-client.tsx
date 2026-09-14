'use client'

import { useMemo, useState, useTransition } from 'react'
import { Cog, Plus, Search } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  createProductionMachine,
  softDeleteProductionMachine,
  updateProductionMachine
} from '@/lib/production-machines/actions'
import type { ProductionMachineListItem } from '@/lib/production-machines/queries'

type ProductionMachinesClientProps = {
  initialRows: ProductionMachineListItem[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: ProductionMachineListItem }

export function ProductionMachinesClient({
  initialRows,
  canWrite
}: ProductionMachinesClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] =
    useState<ProductionMachineListItem | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [usageLimitRaw, setUsageLimitRaw] = useState('100')
  const [active, setActive] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter((row) => {
      return (
        row.name.toLowerCase().includes(term) ||
        (row.comment ?? '').toLowerCase().includes(term) ||
        String(row.usage_limit_per_day).includes(term)
      )
    })
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setComment('')
    setUsageLimitRaw('100')
    setActive(true)
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: ProductionMachineListItem) {
    setName(row.name)
    setComment(row.comment ?? '')
    setUsageLimitRaw(String(row.usage_limit_per_day))
    setActive(row.active)
    setFieldErrors({})
    setEditor({ mode: 'edit', row })
  }

  function closeEditor() {
    if (pending) return
    setEditor({ mode: 'closed' })
    setFieldErrors({})
  }

  function handleSave() {
    startTransition(async () => {
      const result =
        editor.mode === 'edit'
          ? await updateProductionMachine({
              id: editor.row.id,
              name,
              comment,
              usageLimitPerDayRaw: usageLimitRaw,
              active
            })
          : await createProductionMachine({
              name,
              comment,
              usageLimitPerDayRaw: usageLimitRaw,
              active
            })

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit' ? 'Gyártógép mentve.' : 'Gyártógép létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteProductionMachine(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
    })
  }

  const editorOpen = editor.mode !== 'closed'

  return (
    <div>
      <PageHeader
        title="Gyártógépek"
        description="Műhelygépek a megrendelés gyártásba adásához. Nem azonos a Berendezéssel (Excel export)."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új gyártógép
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="production-machine-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="production-machine-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyProductionMachines canWrite={canWrite} onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a „{search}” keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Napi limit
              </DataTableHeaderCell>
              <DataTableHeaderCell>Megjegyzés</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  <span className="font-medium">{row.name}</span>
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums">
                  {row.usage_limit_per_day}
                </DataTableCell>
                <DataTableCell className="max-w-[240px] truncate text-ink-secondary">
                  {row.comment || '—'}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                    {row.active ? 'Aktív' : 'Inaktív'}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canWrite ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          Szerkesztés
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-danger-ink hover:text-danger-ink"
                          onClick={() => setDeleteTarget(row)}
                        >
                          Törlés
                        </Button>
                      </>
                    ) : (
                      <span className="text-hint text-ink-secondary">
                        Csak olvasás
                      </span>
                    )}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editor.mode === 'edit'
                ? 'Gyártógép szerkesztése'
                : 'Új gyártógép'}
            </DialogTitle>
            <DialogDescription>
              A név a gyártásba adás űrlapon jelenik meg.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField
              label="Név"
              htmlFor="production-machine-name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="production-machine-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
                disabled={pending}
              />
            </FormField>

            <FormField
              label="Napi kapacitás"
              htmlFor="production-machine-limit"
              required
              hint="Napi terhelhetőség (egész szám). Későbbi dashboardhoz."
              error={fieldErrors.usageLimitPerDay}
            >
              <Input
                id="production-machine-limit"
                inputMode="numeric"
                value={usageLimitRaw}
                onChange={(e) => setUsageLimitRaw(e.target.value)}
                disabled={pending}
              />
            </FormField>

            <FormField
              label="Megjegyzés"
              htmlFor="production-machine-comment"
              optionalLabel
            >
              <Textarea
                id="production-machine-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                disabled={pending}
              />
            </FormField>

            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={pending}
              />
              Aktív (választható gyártásbaadáskor)
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={closeEditor}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={pending}
              loading={pending}
              onClick={handleSave}
            >
              {editor.mode === 'edit' ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Gyártógép törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” gyártógépet?`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyProductionMachines({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <Cog className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs gyártógép</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá a műhelygépeket, mielőtt megrendelést gyártásba adsz.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új gyártógép
        </Button>
      ) : null}
    </div>
  )
}
