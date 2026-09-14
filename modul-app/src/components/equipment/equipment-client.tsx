'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Search, Wrench } from 'lucide-react'
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
import { MenuSelect } from '@/components/ui/menu-select'
import {
  createEquipment,
  softDeleteEquipment,
  updateEquipment
} from '@/lib/equipment/actions'
import type { EquipmentListItem } from '@/lib/equipment/queries'
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  exportFormatLabel,
  type ExportFormat
} from '@/lib/quotes/export/types'

type EquipmentClientProps = {
  initialRows: EquipmentListItem[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: EquipmentListItem }

const FORMAT_OPTIONS = EXPORT_FORMATS.map((value) => ({
  value,
  label: EXPORT_FORMAT_LABELS[value]
}))

export function EquipmentClient({
  initialRows,
  canWrite
}: EquipmentClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<EquipmentListItem | null>(
    null
  )
  const [name, setName] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('korpus')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter((row) => {
      const formatLabel = exportFormatLabel(row.export_format).toLowerCase()
      return (
        row.name.toLowerCase().includes(term) || formatLabel.includes(term)
      )
    })
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setExportFormat('korpus')
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: EquipmentListItem) {
    setName(row.name)
    setExportFormat(row.export_format)
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
          ? await updateEquipment({
              id: editor.row.id,
              name,
              exportFormat
            })
          : await createEquipment({ name, exportFormat })

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit'
          ? 'Berendezés mentve.'
          : 'Berendezés létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteEquipment(deleteTarget.id)
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
        title="Berendezés"
        description="Műhelygépek. Az export formátum dönti el, milyen Excel készül az árajánlatból."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új berendezés
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="equipment-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="equipment-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név vagy formátum szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyEquipment canWrite={canWrite} onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a „{search}” keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Export formátum</DataTableHeaderCell>
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
                <DataTableCell className="text-ink-secondary">
                  {exportFormatLabel(row.export_format)}
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
              {editor.mode === 'edit'
                ? 'Berendezés szerkesztése'
                : 'Új berendezés'}
            </DialogTitle>
            <DialogDescription>
              A gépkódok az anyagokon vannak. Az export formátum az Excel
              kinézetét határozza meg.
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
              htmlFor="equipment-name"
              required
              error={fieldErrors.name}
              hint={!fieldErrors.name ? 'pl. CNC, Homag SAW' : undefined}
            >
              <Input
                id="equipment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </FormField>

            <FormField
              label="Export formátum"
              htmlFor="equipment-export-format"
              required
              error={fieldErrors.exportFormat}
              hint="Ez dönti el, milyen Excel készül az árajánlatból."
            >
              <MenuSelect
                id="equipment-export-format"
                value={exportFormat}
                options={FORMAT_OPTIONS}
                allowEmpty={false}
                placeholder="Válassz formátumot…"
                onChange={(v) => setExportFormat(v as ExportFormat)}
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
                Berendezés mentése
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
        title="Berendezés törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” berendezést? A lista nem fogja mutatni.`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyEquipment({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <Wrench className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs berendezés</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Adj hozzá gépet, kösd az anyagokhoz — utána az árajánlatról Excel
          exportálható.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új berendezés
        </Button>
      ) : null}
    </div>
  )
}
