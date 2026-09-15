'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import { Download, RectangleHorizontal, Plus, Search, Upload } from 'lucide-react'
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
import { softDeleteLinearMaterial } from '@/lib/linear-materials/actions'
import type { LinearImportPreviewResult } from '@/lib/linear-materials/import-plan'
import {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet
} from '@/lib/linear-materials/parse'
import type { LinearMaterialListItem } from '@/lib/linear-materials/queries'
import { materialTypeLabel } from '@/lib/linear-materials/queries'

type LinearMaterialsListClientProps = {
  rows: LinearMaterialListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
  initialActive: 'all' | 'active' | 'inactive'
}

export function LinearMaterialsListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ,
  initialActive
}: LinearMaterialsListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [deleteTarget, setDeleteTarget] =
    useState<LinearMaterialListItem | null>(null)
  const [previewTarget, setPreviewTarget] =
    useState<LinearMaterialListItem | null>(null)
  const [pending, startTransition] = useTransition()
  const [exportBusy, setExportBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] =
    useState<LinearImportPreviewResult | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  async function downloadExport(mode: 'template' | 'data') {
    setExportBusy(true)
    try {
      const response = await fetch(
        `/api/linear-materials/export?mode=${mode}`
      )
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
        (mode === 'template'
          ? 'szalas_anyagok_sablon.xlsx'
          : 'szalas_anyagok.xlsx')
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
      const response = await fetch('/api/linear-materials/import/preview', {
        method: 'POST',
        body: formData
      })
      const data = (await response.json()) as
        | LinearImportPreviewResult
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
      const response = await fetch('/api/linear-materials/import', {
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

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: qDraft.trim() || null, page: '1' })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteLinearMaterial(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const emptySearch = useMemo(
    () => total === 0 && (initialQ || initialActive !== 'all'),
    [total, initialQ, initialActive]
  )

  return (
    <div>
      <PageHeader
        title="Szálas anyagok"
        description="Szálas / lineáris anyagok (hátfal, munkalap, asztalap) mérettel és Ft/m árral."
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
                  onClick={() =>
                    router.push('/torzsadatok/alapanyagok/szalas-anyagok/uj')
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  Új szálas anyag
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
          <label className="sr-only" htmlFor="linear-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="linear-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Keresés név…"
            className="pl-8"
          />
        </form>

        <div className="w-full sm:w-44">
          <label className="sr-only" htmlFor="linear-active-filter">
            Állapot szűrő
          </label>
          <Select
            id="linear-active-filter"
            value={initialActive}
            onChange={(e) =>
              pushParams({
                active: e.target.value === 'all' ? null : e.target.value,
                page: '1'
              })
            }
          >
            <option value="all">Összes állapot</option>
            <option value="active">Csak aktív</option>
            <option value="inactive">Csak inaktív</option>
          </Select>
        </div>
      </div>

      {total === 0 && !emptySearch ? (
        <EmptyLinears
          canWrite={canWrite}
          onCreate={() =>
            router.push('/torzsadatok/alapanyagok/szalas-anyagok/uj')
          }
        />
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a megadott szűrésre.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell className="w-16">Kép</DataTableHeaderCell>
                <DataTableHeaderCell>Név</DataTableHeaderCell>
                <DataTableHeaderCell>Típus</DataTableHeaderCell>
                <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
                <DataTableHeaderCell>Méret</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Bruttó / m
                </DataTableHeaderCell>
                <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const gross = grossFromNet(row.price_net, row.tax_rate_percent)
                return (
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
                          <RectangleHorizontal className="size-5" />
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <Link
                        href={`/torzsadatok/alapanyagok/szalas-anyagok/${row.id}`}
                        className="font-medium text-ink no-underline hover:underline"
                      >
                        {row.name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      {materialTypeLabel(row.material_type)}
                    </DataTableCell>
                    <DataTableCell>{row.manufacturer_name}</DataTableCell>
                    <DataTableCell className="tabular-nums text-ink-secondary">
                      {row.length_mm} × {row.width_mm} ×{' '}
                      {formatHuNumber(row.thickness_mm)} mm
                    </DataTableCell>
                    <DataTableCell align="right">
                      {formatMoneyFt(gross)}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge tone={row.active ? 'active' : 'neutral'}>
                          {row.active ? 'Aktív' : 'Inaktív'}
                        </StatusBadge>
                        {row.on_stock ? (
                          <StatusBadge tone="success">Raktáron</StatusBadge>
                        ) : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/torzsadatok/alapanyagok/szalas-anyagok/${row.id}`
                            )
                          }
                        >
                          Megnyitás
                        </Button>
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
                )
              })}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-hint text-ink-secondary">
              {from}–{to} / {total} elem
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
              <span className="px-2 text-hint text-ink-secondary">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Szálas anyag törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) „${deleteTarget.name}” anyagot?`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />

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
                ? `${previewTarget.manufacturer_name} · ${previewTarget.length_mm} × ${previewTarget.width_mm} × ${formatHuNumber(previewTarget.thickness_mm)} mm`
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
                  router.push(
                    `/torzsadatok/alapanyagok/szalas-anyagok/${id}`
                  )
                }}
              >
                Anyag megnyitása
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      <th className="px-2 py-1.5 font-medium">Anyag</th>
                      <th className="px-2 py-1.5 font-medium">Megjegyzés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.items.map((item) => (
                      <tr
                        key={`${item.rowNumber}-${item.name}`}
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
                            · {item.manufacturerName} · {item.sizeLabel}
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
                ? `${importPreview.stats.create + importPreview.stats.update} anyag importálása`
                : 'Importálás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyLinears({
  canWrite,
  onCreate
}: {
  canWrite: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <RectangleHorizontal className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">Még nincs szálas anyag</p>
        <p className="max-w-sm text-body text-ink-secondary">
          Add hozzá a szálas anyagokat típus szerint, mérettel és Ft/m árral.
        </p>
      </div>
      {canWrite ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          Új szálas anyag
        </Button>
      ) : null}
    </div>
  )
}
