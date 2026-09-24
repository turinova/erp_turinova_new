'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import {
  Download,
  Package,
  Plus,
  Printer,
  Search,
  Upload
} from 'lucide-react'
import { toast } from 'sonner'

import { ProductLabelPrintDialog } from '@/components/labels/product-label-print-dialog'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { softDeleteAccessory } from '@/lib/accessories/actions'
import type { AccessoryImportPreviewResult } from '@/lib/accessories/import-plan'
import { formatMoneyFt } from '@/lib/accessories/parse'
import type {
  AccessoryListItem,
  AccessoryUnitOption
} from '@/lib/accessories/queries'
import type { ProductLabelPayload } from '@/lib/labels/types'

const LIST_PATH = '/torzsadatok/alapanyagok/termekek'

function toLabelPayload(row: AccessoryListItem): ProductLabelPayload {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    barcodeInternal: row.barcode_internal,
    priceGross: row.price_gross,
    unitShortform: row.unit_shortform
  }
}

type AccessoriesClientProps = {
  initialRows: AccessoryListItem[]
  canWrite: boolean
  canPrintLabels?: boolean
  units?: AccessoryUnitOption[]
}

export function AccessoriesClient({
  initialRows,
  canWrite,
  canPrintLabels = false,
  units = []
}: AccessoriesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AccessoryListItem | null>(
    null
  )
  const [previewTarget, setPreviewTarget] = useState<AccessoryListItem | null>(
    null
  )
  const [labelTarget, setLabelTarget] = useState<ProductLabelPayload | null>(
    null
  )
  const [pending, startTransition] = useTransition()
  const [exportBusy, setExportBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] =
    useState<AccessoryImportPreviewResult | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.sku.toLowerCase().includes(term) ||
        row.manufacturer_name.toLowerCase().includes(term) ||
        (row.barcode ?? '').toLowerCase().includes(term) ||
        (row.barcode_internal ?? '').toLowerCase().includes(term)
    )
  }, [initialRows, search])

  async function downloadExport(mode: 'template' | 'data') {
    setExportBusy(true)
    try {
      const response = await fetch(`/api/accessories/export?mode=${mode}`)
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        toast.error(data?.error || 'A letöltés sikertelen.')
        return
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename =
        match?.[1] ??
        (mode === 'template' ? 'termekek_sablon.xlsx' : 'termekek.xlsx')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(
        mode === 'template' ? 'Sablon letöltve.' : 'Export kész.'
      )
    } catch {
      toast.error('A letöltés sikertelen.')
    } finally {
      setExportBusy(false)
    }
  }

  async function handleImportFileSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      toast.error('Csak .xlsx fájl tölthető fel.')
      return
    }

    setImportBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/accessories/import/preview', {
        method: 'POST',
        body: formData
      })
      const data = (await response.json()) as
        | AccessoryImportPreviewResult
        | { error?: string }
      if (!response.ok || !('stats' in data)) {
        toast.error(
          'error' in data && data.error
            ? data.error
            : 'Az előnézet betöltése sikertelen.'
        )
        return
      }
      setImportFile(file)
      setImportPreview(data)
    } catch {
      toast.error('Az előnézet betöltése sikertelen.')
    } finally {
      setImportBusy(false)
    }
  }

  async function handleImportConfirm() {
    if (!importFile || !importPreview) return
    if (importPreview.stats.create + importPreview.stats.update === 0) {
      toast.error('Nincs importálható érvényes sor.')
      return
    }
    setImportBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const response = await fetch('/api/accessories/import', {
        method: 'POST',
        body: formData
      })
      const data = (await response.json()) as {
        error?: string
        results?: { created: number; updated: number; skippedErrors: number }
      }
      if (!response.ok || !data.results) {
        toast.error(data.error || 'Az import sikertelen.')
        return
      }
      const parts: string[] = []
      if (data.results.created > 0) {
        parts.push(`${data.results.created} új`)
      }
      if (data.results.updated > 0) {
        parts.push(`${data.results.updated} frissítve`)
      }
      toast.success(`Import kész: ${parts.join(', ')}.`)
      setImportFile(null)
      setImportPreview(null)
      router.refresh()
    } catch {
      toast.error('Az import sikertelen.')
    } finally {
      setImportBusy(false)
    }
  }

  function closeImportDialog() {
    if (importBusy) return
    setImportFile(null)
    setImportPreview(null)
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteAccessory(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div>
      <PageHeader
        title="Termékek"
        description="Eladható termékek törzse."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={exportBusy}
              disabled={exportBusy || importBusy}
              onClick={() => downloadExport('data')}
            >
              <Download className="size-3.5" aria-hidden />
              Export
            </Button>
            {canWrite ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  loading={exportBusy}
                  disabled={exportBusy || importBusy}
                  onClick={() => downloadExport('template')}
                >
                  Sablon
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={importBusy}
                  disabled={exportBusy || importBusy}
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="size-3.5" aria-hidden />
                  Import
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={handleImportFileSelect}
                />
                <Button
                  type="button"
                  onClick={() => router.push(`${LIST_PATH}/uj`)}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Új termék
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-3">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative max-w-sm"
        >
          <label className="sr-only" htmlFor="accessory-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="accessory-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, SKU, vonalkód…"
            className="pl-8"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <Package className="size-8 text-ink-secondary" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">
              {initialRows.length === 0 ? 'Még nincs termék' : 'Nincs találat'}
            </p>
            <p className="max-w-sm text-body text-ink-secondary">
              {initialRows.length === 0
                ? 'Új termék vagy Excel import.'
                : 'Próbálj másik keresőkifejezést.'}
            </p>
          </div>
          {canWrite && initialRows.length === 0 ? (
            <Button
              type="button"
              onClick={() => router.push(`${LIST_PATH}/uj`)}
            >
              <Plus className="size-3.5" aria-hidden />
              Új termék
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell className="w-16">Kép</DataTableHeaderCell>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>SKU</DataTableHeaderCell>
              <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Bruttó
              </DataTableHeaderCell>
              <DataTableHeaderCell>Egység</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                {canPrintLabels || canWrite ? 'Műveletek' : null}
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  {row.image_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewTarget(row)}
                      className="block rounded-md border border-border p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={`${row.name} képének megnyitása`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.image_url}
                        alt=""
                        className="size-12 rounded-[5px] object-cover"
                      />
                    </button>
                  ) : (
                    <span
                      className="flex size-12 items-center justify-center rounded-md border border-dashed border-border text-ink-muted"
                      aria-hidden
                    >
                      <Package className="size-5" />
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell className="font-medium text-ink">
                  <Link
                    href={`${LIST_PATH}/${row.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {row.sku}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.manufacturer_name}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {formatMoneyFt(row.price_gross)}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.unit_shortform}
                </DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                      {row.active ? 'Aktív' : 'Inaktív'}
                    </StatusBadge>
                    {row.active && row.sellable_pos === false ? (
                      <StatusBadge tone="neutral">Nem POS</StatusBadge>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canPrintLabels ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Címke: ${row.name}`}
                        title="Címke nyomtatása"
                        onClick={() => setLabelTarget(toLabelPayload(row))}
                      >
                        <Printer className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-ink hover:text-danger-ink"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Törlés
                      </Button>
                    ) : null}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <Dialog
        open={Boolean(previewTarget?.image_url)}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{previewTarget?.name ?? 'Kép'}</DialogTitle>
            <DialogDescription>
              {previewTarget
                ? `${previewTarget.manufacturer_name} · ${previewTarget.sku}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {previewTarget?.image_url ? (
            <div className="overflow-hidden rounded-md border border-border bg-app">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewTarget.image_url}
                alt={previewTarget.name}
                className="mx-auto max-h-[60vh] w-full object-contain"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreviewTarget(null)}
            >
              Bezárás
            </Button>
            {previewTarget ? (
              <Button
                type="button"
                onClick={() => {
                  const id = previewTarget.id
                  setPreviewTarget(null)
                  router.push(`${LIST_PATH}/${id}`)
                }}
              >
                Termék megnyitása
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Termék törlése?"
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

      {canPrintLabels ? (
        <ProductLabelPrintDialog
          open={Boolean(labelTarget)}
          payload={labelTarget}
          units={units}
          onClose={() => setLabelTarget(null)}
        />
      ) : null}

      <Dialog
        open={Boolean(importPreview)}
        onOpenChange={(open) => {
          if (!open) closeImportDialog()
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import előnézet</DialogTitle>
            <DialogDescription>
              Ellenőrizd a sorokat, majd indítsd az importot. A hibás sorok
              kimaradnak.
            </DialogDescription>
          </DialogHeader>
          {importPreview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-hint">
                <StatusBadge tone="neutral">
                  Összesen: {importPreview.stats.total}
                </StatusBadge>
                <StatusBadge tone="success">
                  Új: {importPreview.stats.create}
                </StatusBadge>
                <StatusBadge tone="info">
                  Frissül: {importPreview.stats.update}
                </StatusBadge>
                <StatusBadge
                  tone={
                    importPreview.stats.error > 0 ? 'danger' : 'neutral'
                  }
                >
                  Hiba: {importPreview.stats.error}
                </StatusBadge>
              </div>
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-hint">
                  <thead className="sticky top-0 bg-subtle">
                    <tr className="border-b border-border">
                      <th className="px-2 py-1.5 font-medium">Sor</th>
                      <th className="px-2 py-1.5 font-medium">Művelet</th>
                      <th className="px-2 py-1.5 font-medium">Termék</th>
                      <th className="px-2 py-1.5 font-medium">Megjegyzés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.items.map((item) => (
                      <tr
                        key={`${item.rowNumber}-${item.sku}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-2 py-1.5 tabular-nums text-ink">
                          {item.rowNumber}
                        </td>
                        <td className="px-2 py-1.5 text-ink">
                          {item.action === 'create'
                            ? 'Új'
                            : item.action === 'update'
                              ? 'Frissít'
                              : 'Hiba'}
                        </td>
                        <td className="px-2 py-1.5 text-ink">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-ink-secondary">
                            {' '}
                            · {item.sku} · {item.manufacturerName}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-danger-ink">
                          {item.message ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={importBusy}
              onClick={closeImportDialog}
            >
              Mégse
            </Button>
            <Button
              type="button"
              loading={importBusy}
              disabled={
                importBusy ||
                !importPreview ||
                importPreview.stats.create + importPreview.stats.update === 0
              }
              onClick={handleImportConfirm}
            >
              {importPreview
                ? `${importPreview.stats.create + importPreview.stats.update} termék importálása`
                : 'Importálás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
