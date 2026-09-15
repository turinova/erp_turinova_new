'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { CircleDollarSign, Plus, Search } from 'lucide-react'
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
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  createFeeType,
  softDeleteFeeType,
  updateFeeType
} from '@/lib/fee-types/actions'
import {
  formatHuNumber,
  formatMoneyFt,
  netFromGross,
  parseIntegerInput
} from '@/lib/fee-types/parse'
import type {
  FeeTypeListItem,
  FeeTypeTaxOption,
  FeeTypeUnitOption
} from '@/lib/fee-types/queries'

type FeeTypesClientProps = {
  initialRows: FeeTypeListItem[]
  taxRates: FeeTypeTaxOption[]
  units: FeeTypeUnitOption[]
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: FeeTypeListItem }

function defaultUnitId(units: FeeTypeUnitOption[]): string {
  return (
    units.find((u) => u.shortform.toLowerCase() === 'db')?.id ||
    units[0]?.id ||
    ''
  )
}

export function FeeTypesClient({
  initialRows,
  taxRates,
  units,
  canWrite
}: FeeTypesClientProps) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<FeeTypeListItem | null>(
    null
  )
  const [name, setName] = useState('')
  const [taxRateId, setTaxRateId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [grossRaw, setGrossRaw] = useState('')
  const [active, setActive] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const defaultTaxId =
    taxRates.find((t) => t.is_default)?.id || taxRates[0]?.id || ''
  const preferredUnitId = defaultUnitId(units)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.tax_rate_name.toLowerCase().includes(term) ||
        row.unit_shortform.toLowerCase().includes(term) ||
        row.unit_name.toLowerCase().includes(term)
    )
  }, [initialRows, search])

  const vatPercent =
    taxRates.find((t) => t.id === taxRateId)?.rate_percent ?? 0
  const selectedUnit = units.find((u) => u.id === unitId)
  const unitShort = selectedUnit?.shortform ?? 'db'
  const grossValue = parseIntegerInput(grossRaw)
  const priceNet =
    grossValue === null ? null : netFromGross(grossValue, vatPercent)

  function openCreate() {
    setName('')
    setTaxRateId(defaultTaxId)
    setUnitId(preferredUnitId)
    setGrossRaw('')
    setActive(true)
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: FeeTypeListItem) {
    setName(row.name)
    setTaxRateId(row.tax_rate_id)
    setUnitId(row.unit_id)
    setGrossRaw(String(row.price_gross))
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
    if (priceNet === null) {
      setFieldErrors({ priceNet: 'Érvényes bruttó árat adj meg.' })
      toast.error('Ellenőrizd a megadott adatokat.')
      return
    }

    startTransition(async () => {
      const payload = {
        name,
        taxRateId,
        unitId,
        priceNet,
        active
      }
      const result =
        editor.mode === 'edit'
          ? await updateFeeType({ ...payload, id: editor.row.id })
          : await createFeeType(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        editor.mode === 'edit' ? 'Díj típus mentve.' : 'Díj típus létrehozva.'
      )
      setEditor({ mode: 'closed' })
      setFieldErrors({})
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteFeeType(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
    })
  }

  const editorOpen = editor.mode !== 'closed'
  const missingTax = taxRates.length === 0
  const missingUnit = units.length === 0
  const canCreate = canWrite && !missingTax && !missingUnit

  return (
    <div>
      <PageHeader
        title="Díj típusok"
        description="Fuvar, szerelés és egyéb ajánlati díjak törzse (nem a vágási Ft/m)."
        actions={
          canCreate ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új díj típus
            </Button>
          ) : null
        }
      />

      {missingTax ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink"
          role="status"
        >
          Felvitelhez kell legalább egy{' '}
          <Link
            href="/torzsadatok/rendszer/adonem"
            className="underline underline-offset-2"
          >
            adónem
          </Link>
          .
        </p>
      ) : null}

      {missingUnit ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink"
          role="status"
        >
          Felvitelhez kell legalább egy{' '}
          <Link
            href="/torzsadatok/rendszer/egysegek"
            className="underline underline-offset-2"
          >
            egység
          </Link>{' '}
          (pl. db, óra).
        </p>
      ) : null}

      <div className="mb-3">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative max-w-sm"
        >
          <label className="sr-only" htmlFor="fee-type-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="fee-type-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, egység vagy adónem…"
            className="pl-8"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <CircleDollarSign
            className="size-8 text-ink-secondary"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">
              {initialRows.length === 0
                ? 'Még nincs díj típus'
                : 'Nincs találat'}
            </p>
            <p className="max-w-sm text-body text-ink-secondary">
              {initialRows.length === 0
                ? 'Add hozzá a gyakran használt díjakat (pl. fuvar). Az ajánlathoz később kapcsoljuk.'
                : 'Próbálj másik keresőkifejezést.'}
            </p>
          </div>
          {canCreate && initialRows.length === 0 ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új díj típus
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Bruttó
              </DataTableHeaderCell>
              <DataTableHeaderCell>Egység</DataTableHeaderCell>
              <DataTableHeaderCell>Adónem</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell className="font-medium text-ink">
                  {row.name}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {formatMoneyFt(row.price_gross)}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.unit_shortform}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.tax_rate_name} ({formatHuNumber(row.tax_rate_percent)}%)
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
              {editor.mode === 'edit' ? 'Díj típus szerkesztése' : 'Új díj típus'}
            </DialogTitle>
            <DialogDescription>
              Bruttó árat adj meg; a nettó az adónem alapján számolódik. Az
              egység az ajánlat mennyiségénél jelenik meg.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField
              label="Név"
              htmlFor="fee-type-name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="fee-type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoFocus
                disabled={pending}
                autoComplete="off"
              />
            </FormField>

            <FormField
              label="Egység"
              htmlFor="fee-type-unit"
              required
              error={fieldErrors.unitId}
            >
              <Select
                id="fee-type-unit"
                value={unitId}
                disabled={pending}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="" disabled>
                  Válassz…
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.shortform})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Bruttó ár"
              htmlFor="fee-type-gross"
              required
              error={fieldErrors.priceNet}
              hint={!fieldErrors.priceNet ? `Ft / ${unitShort}` : undefined}
            >
              <div className="relative">
                <Input
                  id="fee-type-gross"
                  value={grossRaw}
                  onChange={(e) => setGrossRaw(e.target.value)}
                  inputMode="numeric"
                  disabled={pending}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                  Ft
                </span>
              </div>
            </FormField>

            <FormField
              label="Adónem"
              htmlFor="fee-type-tax"
              required
              error={fieldErrors.taxRateId}
            >
              <Select
                id="fee-type-tax"
                value={taxRateId}
                disabled={pending}
                onChange={(e) => setTaxRateId(e.target.value)}
              >
                <option value="" disabled>
                  Válassz…
                </option>
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatHuNumber(t.rate_percent)}%)
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Nettó" htmlFor="fee-type-net" hint="Számított">
              <Input
                id="fee-type-net"
                value={priceNet !== null ? formatMoneyFt(priceNet) : '—'}
                readOnly
                disabled
                tabIndex={-1}
              />
            </FormField>

            <Switch
              id="fee-type-active"
              checked={active}
              disabled={pending}
              onCheckedChange={setActive}
              label="Aktív"
              description="Inaktív díj később nem választható az ajánlaton."
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
            <Button type="button" loading={pending} onClick={handleSave}>
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Díj típus törlése?"
        description={
          deleteTarget
            ? `A „${deleteTarget.name}” soft delete lesz — a meglévő ajánlatok snapshotjai megmaradnak.`
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
