'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Search, Tags } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import {
  createEmployeeType,
  softDeleteEmployeeType,
  updateEmployeeType
} from '@/lib/jelenlet/employee-types-actions'
import type { HrEmployeeTypeRow } from '@/lib/jelenlet/types'

type Props = {
  initialRows: HrEmployeeTypeRow[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: HrEmployeeTypeRow }

export function EmployeeTypesClient({ initialRows, canWrite }: Props) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<HrEmployeeTypeRow | null>(
    null
  )
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [active, setActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.code.toLowerCase().includes(term)
    )
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setCode('')
    setSortOrder('100')
    setActive(true)
    setIsDefault(false)
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: HrEmployeeTypeRow) {
    setName(row.name)
    setCode(row.code)
    setSortOrder(String(row.sortOrder))
    setActive(row.active)
    setIsDefault(row.isDefault)
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
      const payload = {
        name,
        code,
        sortOrder: Number(sortOrder) || 0,
        active,
        isDefault
      }
      const result =
        editor.mode === 'edit'
          ? await updateEmployeeType({ id: editor.row.id, ...payload })
          : await createEmployeeType(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit' ? 'Típus mentve.' : 'Típus létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteEmployeeType({ id: deleteTarget.id })
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
        title="Dolgozó típusok"
        description="Bolt, műhely, iroda — a dolgozó űrlap és lista ezekből választ."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új típus
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="employee-type-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="employee-type-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név vagy kód szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyTypes canWrite={canWrite} onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a „{search}” keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Kód</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                Sorrend
              </DataTableHeaderCell>
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{row.name}</span>
                    {row.isDefault ? (
                      <StatusBadge tone="info">Alapértelmezett</StatusBadge>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <span className="tabular-nums text-ink-secondary">
                    {row.code || '—'}
                  </span>
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink-secondary">
                  {row.sortOrder}
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
                          disabled={row.isDefault}
                          title={
                            row.isDefault
                              ? 'Az alapértelmezett típust nem lehet törölni'
                              : undefined
                          }
                        >
                          Törlés
                        </Button>
                      </>
                    ) : (
                      <span className="text-hint text-ink-muted">—</span>
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
              {editor.mode === 'edit' ? 'Típus szerkesztése' : 'Új típus'}
            </DialogTitle>
            <DialogDescription>
              A név a dolgozó űrlapon és listán jelenik meg.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
          >
            <FormField
              label="Név"
              htmlFor="emp-type-name"
              required
              error={fieldErrors.name}
              hint={!fieldErrors.name ? 'pl. Bolt, Műhely, Iroda' : undefined}
            >
              <Input
                id="emp-type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </FormField>

            <FormField
              label="Kód"
              htmlFor="emp-type-code"
              optionalLabel
              error={fieldErrors.code}
              hint={!fieldErrors.code ? 'pl. bolt, muhely' : undefined}
            >
              <Input
                id="emp-type-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
            </FormField>

            <FormField
              label="Sorrend"
              htmlFor="emp-type-sort"
              error={fieldErrors.sortOrder}
              hint="Kisebb szám = előrébb a listában."
            >
              <Input
                id="emp-type-sort"
                type="number"
                min={0}
                max={9999}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <div className="space-y-3 pt-1">
              <Switch
                id="emp-type-active"
                checked={active}
                onCheckedChange={setActive}
                disabled={pending}
                label="Aktív"
                description="Inaktív típus nem választható új dolgozónál."
              />
              <Switch
                id="emp-type-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
                disabled={pending}
                label="Alapértelmezett"
                description="Új dolgozó űrlapon ez lesz előválasztva."
              />
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
              <Button type="submit" loading={pending}>
                Típus mentése
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Típus törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” típust? A lista nem fogja mutatni.`
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

function EmptyTypes({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <Tags className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs típus</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá a dolgozó kategóriákat (pl. Bolt, Műhely, Iroda), majd
          rendeld hozzá őket a dolgozókhoz.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új típus
        </Button>
      ) : null}
    </div>
  )
}
