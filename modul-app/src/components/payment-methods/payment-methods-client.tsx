'use client'

import { useMemo, useState, useTransition } from 'react'
import { CreditCard, Plus, Search } from 'lucide-react'
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
  createPaymentMethod,
  softDeletePaymentMethod,
  updatePaymentMethod
} from '@/lib/payment-methods/actions'
import type { PaymentMethodListItem } from '@/lib/payment-methods/queries'

type PaymentMethodsClientProps = {
  initialRows: PaymentMethodListItem[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: PaymentMethodListItem }

export function PaymentMethodsClient({
  initialRows,
  canWrite
}: PaymentMethodsClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] =
    useState<PaymentMethodListItem | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [active, setActive] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter((row) => {
      return (
        row.name.toLowerCase().includes(term) ||
        (row.comment ?? '').toLowerCase().includes(term)
      )
    })
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setComment('')
    setActive(true)
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: PaymentMethodListItem) {
    setName(row.name)
    setComment(row.comment ?? '')
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
          ? await updatePaymentMethod({
              id: editor.row.id,
              name,
              comment,
              active
            })
          : await createPaymentMethod({ name, comment, active })

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit'
          ? 'Fizetési mód mentve.'
          : 'Fizetési mód létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeletePaymentMethod(deleteTarget.id)
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
        title="Fizetési módok"
        description="Előleg és megrendelés befizetésekhez."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új fizetési mód
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="payment-method-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="payment-method-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyPaymentMethods canWrite={canWrite} onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a „{search}” keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
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
                <DataTableCell className="max-w-[280px] truncate text-ink-secondary">
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
                ? 'Fizetési mód szerkesztése'
                : 'Új fizetési mód'}
            </DialogTitle>
            <DialogDescription>
              A név megjelenik a megrendelés és befizetés űrlapokon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField
              label="Név"
              htmlFor="payment-method-name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="payment-method-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={pending}
              />
            </FormField>

            <FormField
              label="Megjegyzés"
              htmlFor="payment-method-comment"
              hint="Opcionális belső megjegyzés."
            >
              <Textarea
                id="payment-method-comment"
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
              Aktív (választható megrendeléskor)
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
        title="Fizetési mód törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” fizetési módot? A korábbi befizetéseken a név megmarad.`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyPaymentMethods({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <CreditCard className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs fizetési mód</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá legalább a készpénzt, utalást és bankkártyát, mielőtt
          megrendelést rögzítesz előleggel.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új fizetési mód
        </Button>
      ) : null}
    </div>
  )
}
