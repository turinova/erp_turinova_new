'use client'

import { useMemo, useState, useTransition } from 'react'
import { Percent, Plus, Search } from 'lucide-react'
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
  createTaxRate,
  softDeleteTaxRate,
  updateTaxRate
} from '@/lib/tax-rates/actions'
import { formatRatePercent } from '@/lib/tax-rates/parse'
import type { TaxRateListItem } from '@/lib/tax-rates/queries'

type TaxRatesClientProps = {
  initialRows: TaxRateListItem[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: TaxRateListItem }

export function TaxRatesClient({
  initialRows,
  canWrite
}: TaxRatesClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<TaxRateListItem | null>(
    null
  )
  const [name, setName] = useState('')
  const [rateRaw, setRateRaw] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter((row) => {
      return (
        row.name.toLowerCase().includes(term) ||
        formatRatePercent(row.rate_percent).includes(term) ||
        String(row.rate_percent).includes(term)
      )
    })
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setRateRaw('')
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: TaxRateListItem) {
    setName(row.name)
    setRateRaw(formatRatePercent(row.rate_percent).replace(/\s/g, ''))
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
          ? await updateTaxRate({
              id: editor.row.id,
              name,
              ratePercentRaw: rateRaw
            })
          : await createTaxRate({ name, ratePercentRaw: rateRaw })

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit' ? 'Adónem mentve.' : 'Adónem létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteTaxRate(deleteTarget.id)
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
        title="Adónem"
        description="ÁFA kulcsok a számlázáshoz és árképzéshez."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új adónem
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <label className="sr-only" htmlFor="tax-rate-search">
          Keresés
        </label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="tax-rate-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név vagy % szerint…"
            className="pl-8"
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <EmptyTaxRates canWrite={canWrite} onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a „{search}” keresésre.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Kulcs (%)</DataTableHeaderCell>
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
                <DataTableCell align="right">
                  {formatRatePercent(row.rate_percent)}%
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
              {editor.mode === 'edit' ? 'Adónem szerkesztése' : 'Új adónem'}
            </DialogTitle>
            <DialogDescription>
              Add meg a megjelenő nevet és az ÁFA kulcsot százalékban.
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
              htmlFor="tax-rate-name"
              required
              error={fieldErrors.name}
              hint={!fieldErrors.name ? 'pl. ÁFA 27%' : undefined}
            >
              <Input
                id="tax-rate-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </FormField>

            <FormField
              label="Kulcs"
              htmlFor="tax-rate-percent"
              required
              error={fieldErrors.ratePercent}
              hint={!fieldErrors.ratePercent ? '0–100, pl. 27 vagy 5,5' : undefined}
            >
              <div className="relative">
                <Input
                  id="tax-rate-percent"
                  value={rateRaw}
                  onChange={(e) => setRateRaw(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                  %
                </span>
              </div>
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
                Adónem mentése
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
        title="Adónem törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” adónemet? A lista nem fogja mutatni; a már rögzített dokumentumok a régi értéket őrizhetik.`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EmptyTaxRates({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <Percent className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs adónem</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá a céged ÁFA kulcsait (pl. 0%, 5%, 27%), hogy az árakon
          helyesen számolhass.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új adónem
        </Button>
      ) : null}
    </div>
  )
}
