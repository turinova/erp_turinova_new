'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Ruler, Search } from 'lucide-react'
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
import {
  createUnit,
  softDeleteUnit,
  updateUnit
} from '@/lib/units/actions'
import type { UnitListItem } from '@/lib/units/queries'

type UnitsClientProps = {
  initialRows: UnitListItem[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: UnitListItem }

export function UnitsClient({ initialRows, canWrite }: UnitsClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<UnitListItem | null>(null)
  const [name, setName] = useState('')
  const [shortform, setShortform] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.shortform.toLowerCase().includes(term)
    )
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setShortform('')
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: UnitListItem) {
    setName(row.name)
    setShortform(row.shortform)
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
          ? await updateUnit({ id: editor.row.id, name, shortform })
          : await createUnit({ name, shortform })

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit' ? 'Egység mentve.' : 'Egység létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteUnit(deleteTarget.id)
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
        title="Egységek"
        description="Mennyiségekhez használt mértékegységek (név és rövidítés)."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új egység
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="unit-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="unit-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név vagy rövidítés szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyUnits canWrite={canWrite} onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a „{search}” keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Rövidítés</DataTableHeaderCell>
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
                <DataTableCell>
                  <span className="tabular-nums text-ink-secondary">
                    {row.shortform}
                  </span>
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
              {editor.mode === 'edit' ? 'Egység szerkesztése' : 'Új egység'}
            </DialogTitle>
            <DialogDescription>
              A név a listákban, a rövidítés a mennyiségek mellett jelenik meg.
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
              htmlFor="unit-name"
              required
              error={fieldErrors.name}
              hint={!fieldErrors.name ? 'pl. Darab, Méter' : undefined}
            >
              <Input
                id="unit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </FormField>

            <FormField
              label="Rövidítés"
              htmlFor="unit-shortform"
              required
              error={fieldErrors.shortform}
              hint={!fieldErrors.shortform ? 'pl. db, m, m2, kg' : undefined}
            >
              <Input
                id="unit-shortform"
                value={shortform}
                onChange={(e) => setShortform(e.target.value)}
                autoComplete="off"
              />
            </FormField>

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
                Egység mentése
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
        title="Egység törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” (${deleteTarget.shortform}) egységet? A lista nem fogja mutatni.`
            : ''
        }
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyUnits({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <Ruler className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs egység</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá a mértékegységeket (pl. db, m, m2, mm, kg), amelyeket a
          mennyiségeknél használsz.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új egység
        </Button>
      ) : null}
    </div>
  )
}
