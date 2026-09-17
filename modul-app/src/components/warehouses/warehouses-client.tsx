'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Search, Warehouse } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  createWarehouse,
  softDeleteWarehouse,
  updateWarehouse
} from '@/lib/warehouses/actions'
import type { WarehouseListItem } from '@/lib/warehouses/queries'

type WarehousesClientProps = {
  initialRows: WarehouseListItem[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: WarehouseListItem }

type FormState = {
  name: string
  code: string
  isDefault: boolean
  isActive: boolean
  country: string
  postalCode: string
  city: string
  street: string
  houseNumber: string
  note: string
}

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  isDefault: false,
  isActive: true,
  country: 'Magyarország',
  postalCode: '',
  city: '',
  street: '',
  houseNumber: '',
  note: ''
}

function rowToForm(row: WarehouseListItem): FormState {
  return {
    name: row.name,
    code: row.code,
    isDefault: row.is_default,
    isActive: row.is_active,
    country: row.country ?? '',
    postalCode: row.postal_code ?? '',
    city: row.city ?? '',
    street: row.street ?? '',
    houseNumber: row.house_number ?? '',
    note: row.note ?? ''
  }
}

export function WarehousesClient({
  initialRows,
  canWrite
}: WarehousesClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<WarehouseListItem | null>(
    null
  )
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const activeCount = initialRows.filter((r) => r.is_active).length

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter((row) => {
      return (
        row.name.toLowerCase().includes(term) ||
        row.code.toLowerCase().includes(term) ||
        (row.city ?? '').toLowerCase().includes(term)
      )
    })
  }, [initialRows, search])

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      isDefault: initialRows.length === 0
    })
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: WarehouseListItem) {
    setForm(rowToForm(row))
    setFieldErrors({})
    setEditor({ mode: 'edit', row })
  }

  function closeEditor() {
    if (pending) return
    setEditor({ mode: 'closed' })
    setFieldErrors({})
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function handleSave() {
    startTransition(async () => {
      const payload = {
        name: form.name,
        code: form.code,
        isDefault: form.isDefault,
        isActive: form.isActive,
        country: form.country,
        postalCode: form.postalCode,
        city: form.city,
        street: form.street,
        houseNumber: form.houseNumber,
        note: form.note
      }

      const result =
        editor.mode === 'edit'
          ? await updateWarehouse({ id: editor.row.id, ...payload })
          : await createWarehouse(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit' ? 'Raktár mentve.' : 'Raktár létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteWarehouse(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
    })
  }

  const editorOpen = editor.mode !== 'closed'
  const cannotUnsetDefault =
    form.isDefault &&
    (editor.mode === 'edit'
      ? editor.row.is_default || initialRows.length <= 1
      : initialRows.length === 0)

  return (
    <div>
      <PageHeader
        title="Raktárak"
        description="Hol tárolod a készletet. Az új rendelések az alapértelmezett raktárra mennek."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új raktár
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="warehouse-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="warehouse-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, kód vagy város szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyWarehouses canWrite={canWrite} onCreate={openCreate} />
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
              <DataTableHeaderCell>Város</DataTableHeaderCell>
              <DataTableHeaderCell>Státusz</DataTableHeaderCell>
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
                  {row.is_default ? (
                    <span className="ml-2 text-hint text-ink-secondary">
                      alapértelmezett
                    </span>
                  ) : null}
                </DataTableCell>
                <DataTableCell>
                  <span className="font-mono text-hint">{row.code}</span>
                </DataTableCell>
                <DataTableCell>
                  {row.city ? (
                    <span className="text-ink-secondary">{row.city}</span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </DataTableCell>
                <DataTableCell>
                  {row.is_active ? (
                    <span className="text-body text-ink">Aktív</span>
                  ) : (
                    <span className="text-body text-ink-secondary">
                      Inaktív
                    </span>
                  )}
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
                          disabled={row.is_default || activeCount <= 1}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor.mode === 'edit' ? 'Raktár szerkesztése' : 'Új raktár'}
            </DialogTitle>
            <DialogDescription>
              Add meg a raktár nevét és rövid kódját. Az alapértelmezett raktárra
              mennek az új beszállítói rendelések.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Név"
                htmlFor="warehouse-name"
                required
                error={fieldErrors.name}
                className="col-span-2 sm:col-span-1"
              >
                <Input
                  id="warehouse-name"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  autoComplete="off"
                  autoFocus
                />
              </FormField>
              <FormField
                label="Kód"
                htmlFor="warehouse-code"
                required
                error={fieldErrors.code}
                hint={!fieldErrors.code ? 'pl. FO, WEB, BP' : undefined}
                className="col-span-2 sm:col-span-1"
              >
                <Input
                  id="warehouse-code"
                  value={form.code}
                  onChange={(e) => patchForm({ code: e.target.value })}
                  autoComplete="off"
                  className="font-mono uppercase"
                />
              </FormField>
            </div>

            <Switch
              id="warehouse-active"
              checked={form.isActive}
              disabled={form.isDefault}
              onCheckedChange={(checked) => patchForm({ isActive: checked })}
              label="Aktív"
              description={
                form.isDefault
                  ? 'Az alapértelmezett raktár mindig aktív.'
                  : undefined
              }
            />
            {fieldErrors.isActive ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.isActive}
              </p>
            ) : null}

            <Switch
              id="warehouse-default"
              checked={form.isDefault}
              disabled={cannotUnsetDefault}
              onCheckedChange={(checked) => {
                if (!checked && cannotUnsetDefault) return
                patchForm({
                  isDefault: checked,
                  isActive: checked ? true : form.isActive
                })
              }}
              label="Alapértelmezett raktár"
              description={
                cannotUnsetDefault
                  ? editor.mode === 'edit' && editor.row.is_default
                    ? 'Másik raktárnál kapcsold be az „Alapértelmezett” kapcsolót, ha át szeretnéd tenni.'
                    : 'Ha csak egy raktár van, az mindig alapértelmezett.'
                  : 'Az új rendelések ide kerülnek, amíg nincs külön választó.'
              }
            />
            {fieldErrors.isDefault ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.isDefault}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Ország"
                htmlFor="warehouse-country"
                error={fieldErrors.country}
                className="col-span-2 sm:col-span-1"
              >
                <Input
                  id="warehouse-country"
                  value={form.country}
                  onChange={(e) => patchForm({ country: e.target.value })}
                  autoComplete="country-name"
                />
              </FormField>
              <FormField
                label="Irányítószám"
                htmlFor="warehouse-postal"
                error={fieldErrors.postalCode}
                className="col-span-2 sm:col-span-1"
              >
                <Input
                  id="warehouse-postal"
                  value={form.postalCode}
                  onChange={(e) => patchForm({ postalCode: e.target.value })}
                  autoComplete="postal-code"
                />
              </FormField>
              <FormField
                label="Város"
                htmlFor="warehouse-city"
                error={fieldErrors.city}
                className="col-span-2"
              >
                <Input
                  id="warehouse-city"
                  value={form.city}
                  onChange={(e) => patchForm({ city: e.target.value })}
                  autoComplete="address-level2"
                />
              </FormField>
              <FormField
                label="Utca"
                htmlFor="warehouse-street"
                error={fieldErrors.street}
                className="col-span-2 sm:col-span-1"
              >
                <Input
                  id="warehouse-street"
                  value={form.street}
                  onChange={(e) => patchForm({ street: e.target.value })}
                  autoComplete="street-address"
                />
              </FormField>
              <FormField
                label="Házszám"
                htmlFor="warehouse-house"
                error={fieldErrors.houseNumber}
                className="col-span-2 sm:col-span-1"
              >
                <Input
                  id="warehouse-house"
                  value={form.houseNumber}
                  onChange={(e) => patchForm({ houseNumber: e.target.value })}
                />
              </FormField>
            </div>

            <FormField
              label="Megjegyzés"
              htmlFor="warehouse-note"
              error={fieldErrors.note}
            >
              <Textarea
                id="warehouse-note"
                value={form.note}
                onChange={(e) => patchForm({ note: e.target.value })}
                rows={3}
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
                Raktár mentése
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
        title="Raktár törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” raktárat? A lista nem fogja mutatni.`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyWarehouses({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <Warehouse className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs raktár</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Hozz létre legalább egy raktárat — ide érkezik majd a beszállítói áru.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új raktár
        </Button>
      ) : null}
    </div>
  )
}
