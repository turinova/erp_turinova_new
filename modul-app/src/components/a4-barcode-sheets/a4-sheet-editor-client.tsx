'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Download, LayoutGrid, Save, X } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button, buttonVariants } from '@/components/ui/button'
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
  createA4BarcodeSheet,
  updateA4BarcodeSheet
} from '@/lib/a4-barcode-sheets/actions'
import { A4CellPreview } from '@/components/a4-barcode-sheets/a4-cell-preview'
import { A4SheetPreview } from '@/components/a4-barcode-sheets/a4-sheet-preview'
import { downloadA4BarcodeSheetPdf } from '@/lib/a4-barcode-sheets/pdf'
import {
  A4_NAME_DEFAULT_MAX_CHARS,
  packA4Cell,
  truncateA4
} from '@/lib/a4-barcode-sheets/layout'
import { resolveA4PrintableBarcode } from '@/lib/a4-barcode-sheets/print-policy'
import type { A4ProductSearchItem } from '@/lib/a4-barcode-sheets/queries'
import {
  A4_GRID_PRESETS,
  A4_PAGE_KEY,
  DEFAULT_NEW_CELL_FIELDS,
  cellInnerSizeMm,
  cellKey,
  type A4BarcodeSource,
  type A4SheetCellDraft
} from '@/lib/a4-barcode-sheets/types'
import { cn } from '@/lib/utils'

type Props = {
  mode: 'create' | 'edit'
  sheetId?: string
  initialName: string
  initialCols: number
  initialRows: number
  initialMarginMm: number
  initialShowName: boolean
  initialShowSku: boolean
  initialShowPrice: boolean
  initialCells: A4SheetCellDraft[]
  canWrite: boolean
}

type PickerState =
  | { open: false }
  | { open: true; row: number; col: number; existing: A4SheetCellDraft | null }

export function A4SheetEditorClient({
  mode,
  sheetId,
  initialName,
  initialCols,
  initialRows,
  initialMarginMm,
  initialShowName,
  initialShowSku,
  initialShowPrice,
  initialCells,
  canWrite
}: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [cols, setCols] = useState(initialCols)
  const [rows, setRows] = useState(initialRows)
  const [marginMm] = useState(initialMarginMm)
  const [showName] = useState(initialShowName)
  const [showSku] = useState(initialShowSku)
  const [showPrice] = useState(initialShowPrice)
  const [cells, setCells] = useState<A4SheetCellDraft[]>(() =>
    initialCells.map((c) => ({
      ...c,
      unitSnap: c.unitSnap?.trim() || 'db',
      showName: c.showName ?? true,
      showSku: c.showSku ?? true,
      showPrice: c.showPrice ?? true,
      showBarcode: c.showBarcode ?? true
    }))
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [picker, setPicker] = useState<PickerState>({ open: false })
  const [pending, startTransition] = useTransition()
  const [pdfBusy, setPdfBusy] = useState(false)

  const cellMap = useMemo(() => {
    const m = new Map<string, A4SheetCellDraft>()
    for (const c of cells) m.set(cellKey(c.row, c.col), c)
    return m
  }, [cells])

  const { widthMm: cellW, heightMm: cellH } = cellInnerSizeMm(
    cols,
    rows,
    marginMm
  )
  // Always 44 — width only affects PDF wrap/font, not snap length
  const nameCap = A4_NAME_DEFAULT_MAX_CHARS

  function applyPreset(presetCols: number, presetRows: number) {
    setCols(presetCols)
    setRows(presetRows)
    setCells((prev) =>
      prev.filter((c) => c.row < presetRows && c.col < presetCols)
    )
  }

  function openCell(row: number, col: number) {
    if (!canWrite) return
    setPicker({
      open: true,
      row,
      col,
      existing: cellMap.get(cellKey(row, col)) ?? null
    })
  }

  function clearCell(row: number, col: number) {
    setCells((prev) => prev.filter((c) => !(c.row === row && c.col === col)))
    setPicker({ open: false })
  }

  function upsertCell(next: A4SheetCellDraft) {
    setCells((prev) => {
      const without = prev.filter(
        (c) => !(c.row === next.row && c.col === next.col)
      )
      return [...without, next]
    })
  }

  function placeProduct(
    row: number,
    col: number,
    product: A4ProductSearchItem,
    source: A4BarcodeSource,
    keepFields?: Pick<
      A4SheetCellDraft,
      'showName' | 'showSku' | 'showPrice' | 'showBarcode' | 'nameSnap'
    >
  ) {
    const resolved = resolveA4PrintableBarcode(
      {
        barcode: product.barcode,
        barcodeInternal: product.barcode_internal
      },
      cellW,
      source
    )
    if (resolved.blocked || !resolved.value) {
      toast.error(resolved.message ?? 'Nem nyomtatható vonalkód.')
      return
    }
    if (resolved.forcedInternal) {
      toast.message(resolved.message ?? 'Belső EAN-t használunk.')
    }
    const next: A4SheetCellDraft = {
      row,
      col,
      accessoryId: product.id,
      barcodeValue: resolved.value,
      barcodeSource: (resolved.source === 'none'
        ? source
        : resolved.source) as A4BarcodeSource,
      // Új / csere termék → törzsértékek; név/ár/egység a cella panelen szerkeszthető.
      nameSnap: truncateA4(product.name, nameCap),
      skuSnap: product.sku,
      priceGross: product.price_gross,
      unitSnap: product.unit_shortform?.trim() || 'db',
      showName: keepFields?.showName ?? DEFAULT_NEW_CELL_FIELDS.showName,
      showSku: keepFields?.showSku ?? DEFAULT_NEW_CELL_FIELDS.showSku,
      showPrice: keepFields?.showPrice ?? DEFAULT_NEW_CELL_FIELDS.showPrice,
      showBarcode:
        keepFields?.showBarcode ?? DEFAULT_NEW_CELL_FIELDS.showBarcode,
      accessoryDeleted: false
    }
    upsertCell(next)
    // Marad nyitva — élő JPEG előnézet (címke modal mintára)
    setPicker({ open: true, row, col, existing: next })
  }

  function buildPayload() {
    return {
      name,
      cols,
      rows,
      marginMm,
      showName,
      showSku,
      showPrice,
      cells: cells.map((c) => ({
        row: c.row,
        col: c.col,
        accessoryId: c.accessoryId,
        barcodeValue: c.barcodeValue,
        barcodeSource: c.barcodeSource,
        nameSnap: truncateA4(c.nameSnap, nameCap),
        skuSnap: c.skuSnap,
        priceGross: c.priceGross ?? null,
        unitSnap: c.unitSnap?.trim() || 'db',
        showName: c.showName,
        showSku: c.showSku,
        showPrice: c.showPrice,
        showBarcode: c.showBarcode
      }))
    }
  }

  function handleSave() {
    if (!canWrite) return
    setFieldErrors({})
    startTransition(async () => {
      const payload = buildPayload()
      const res =
        mode === 'edit' && sheetId
          ? await updateA4BarcodeSheet(sheetId, payload)
          : await createA4BarcodeSheet(payload)
      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors)
        toast.error(res.message)
        return
      }
      toast.success('Lap mentve.')
      if (mode === 'create') {
        router.replace(`${A4_PAGE_KEY}/${res.id}`)
      } else {
        router.refresh()
      }
    })
  }

  async function handlePdf() {
    if (!canWrite) {
      toast.error('Csak megtekintési jogod van — PDF nem készíthető.')
      return
    }
    if (cells.length === 0) {
      toast.error('Legalább egy kitöltött cella kell a PDF-hez.')
      return
    }
    // Re-check fit at current grid
    for (const c of cells) {
      const fit = resolveA4PrintableBarcode(
        { barcode: c.barcodeValue, barcodeInternal: c.barcodeValue },
        cellW,
        'supplier'
      )
      if (fit.blocked) {
        toast.error(
          `A(z) ${c.row + 1}. sor ${c.col + 1}. oszlop kódja nem fér a cellába. Ritkább rács kell.`
        )
        return
      }
    }
    setPdfBusy(true)
    try {
      await downloadA4BarcodeSheetPdf({
        name: name.trim() || 'Vonalkód lap',
        cols,
        rows,
        marginMm,
        fields: { showName, showSku, showPrice },
        cells
      })
      toast.success('PDF letöltve. Nyomtatás: 100% / tényleges méret.')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nem sikerült a PDF készítése.'
      )
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={mode === 'create' ? 'Új vonalkód lap' : name || 'Vonalkód lap'}
        description="Az előnézet a nyomtatási PDF-et mutatja. Kattints egy cellára — primary: PDF letöltése."
        icon={LayoutGrid}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={A4_PAGE_KEY}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'sm' }),
                'no-underline'
              )}
            >
              Lista
            </Link>
            {canWrite ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={handleSave}
              >
                <Save className="size-3.5" aria-hidden />
                Mentés
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              loading={pdfBusy}
              disabled={!canWrite}
              onClick={() => void handlePdf()}
            >
              <Download className="size-3.5" aria-hidden />
              PDF letöltése
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-md border border-border bg-surface p-3">
          <FormField label="Lap neve" htmlFor="a4-name" error={fieldErrors.name}>
            <Input
              id="a4-name"
              value={name}
              disabled={!canWrite}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
            />
          </FormField>

          <div>
            <p className="mb-1.5 text-label text-ink-secondary">Rács preset</p>
            <div className="flex flex-col gap-1.5">
              {A4_GRID_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={
                    cols === p.cols && rows === p.rows ? 'primary' : 'secondary'
                  }
                  disabled={!canWrite}
                  className="justify-start"
                  onClick={() => applyPreset(p.cols, p.rows)}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="ml-2 text-ink-tertiary">{p.hint}</span>
                </Button>
              ))}
            </div>
          </div>

        </aside>

        <div className="overflow-auto rounded-md border border-border bg-surface p-3">
          <A4SheetPreview
            name={name}
            cols={cols}
            rows={rows}
            marginMm={marginMm}
            showName={showName}
            showSku={showSku}
            showPrice={showPrice}
            cells={cells}
            canWrite={canWrite}
            onCellClick={openCell}
          />
        </div>
      </div>

      <CellPickerDialog
        state={picker}
        cellWidthMm={cellW}
        cellHeightMm={cellH}
        nameMaxChars={nameCap}
        onClose={() => setPicker({ open: false })}
        onClear={clearCell}
        onPick={placeProduct}
        onUpdateCell={(cell) => {
          upsertCell({
            ...cell,
            nameSnap: truncateA4(cell.nameSnap, nameCap)
          })
          setPicker({ open: false })
          toast.success('Cella frissítve.')
        }}
      />
    </div>
  )
}

function CellPickerDialog({
  state,
  cellWidthMm,
  cellHeightMm,
  nameMaxChars,
  onClose,
  onClear,
  onPick,
  onUpdateCell
}: {
  state: PickerState
  cellWidthMm: number
  cellHeightMm: number
  nameMaxChars: number
  onClose: () => void
  onClear: (row: number, col: number) => void
  onPick: (
    row: number,
    col: number,
    product: A4ProductSearchItem,
    source: A4BarcodeSource,
    keepFields?: Pick<
      A4SheetCellDraft,
      'showName' | 'showSku' | 'showPrice' | 'showBarcode' | 'nameSnap'
    >
  ) => void
  onUpdateCell: (cell: A4SheetCellDraft) => void
}) {
  const open = state.open
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<A4ProductSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [source, setSource] = useState<A4BarcodeSource>('auto')
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState(0)
  const [editUnit, setEditUnit] = useState('db')
  const [cellShowName, setCellShowName] = useState(
    DEFAULT_NEW_CELL_FIELDS.showName
  )
  const [cellShowSku, setCellShowSku] = useState(DEFAULT_NEW_CELL_FIELDS.showSku)
  const [cellShowPrice, setCellShowPrice] = useState(
    DEFAULT_NEW_CELL_FIELDS.showPrice
  )
  const [cellShowBarcode, setCellShowBarcode] = useState(
    DEFAULT_NEW_CELL_FIELDS.showBarcode
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open || !state.open) return
    setQ('')
    setHits([])
    setErr(null)
    setSource('auto')
    const ex = state.existing
    if (ex) {
      setEditName(ex.nameSnap)
      setEditPrice(Math.round(Number(ex.priceGross) || 0))
      setEditUnit(ex.unitSnap?.trim() || 'db')
      setCellShowName(ex.showName)
      setCellShowSku(ex.showSku)
      setCellShowPrice(ex.showPrice)
      setCellShowBarcode(ex.showBarcode)
    } else {
      setEditName('')
      setEditPrice(0)
      setEditUnit('db')
      setCellShowName(DEFAULT_NEW_CELL_FIELDS.showName)
      setCellShowSku(DEFAULT_NEW_CELL_FIELDS.showSku)
      setCellShowPrice(DEFAULT_NEW_CELL_FIELDS.showPrice)
      setCellShowBarcode(DEFAULT_NEW_CELL_FIELDS.showBarcode)
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, state])

  const search = useCallback(async (term: string) => {
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    if (term.trim().length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const sp = new URLSearchParams({ q: term.trim(), limit: '15' })
      const res = await fetch(`/api/vonalkod-lap/product-search?${sp}`, {
        signal: ac.signal,
        headers: { Accept: 'application/json' }
      })
      const body = (await res.json().catch(() => null)) as {
        rows?: A4ProductSearchItem[]
        error?: string
      } | null
      if (!res.ok) {
        setErr(body?.error || 'Keresési hiba.')
        setHits([])
        return
      }
      setHits(body?.rows ?? [])
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setErr('Keresési hiba.')
      setHits([])
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => void search(q), 220)
    return () => window.clearTimeout(t)
  }, [q, open, search])

  if (!state.open) return null
  const { row, col, existing } = state
  const packHint = packA4Cell(cellWidthMm, cellHeightMm, {
    showName: cellShowName,
    showSku: cellShowSku,
    showPrice: cellShowPrice,
    showBarcode: cellShowBarcode
  })

  const previewCell: A4SheetCellDraft | null = existing
    ? {
        ...existing,
        nameSnap: editName,
        priceGross: editPrice,
        unitSnap: editUnit.trim() || 'db',
        showName: cellShowName,
        showSku: cellShowSku,
        showPrice: cellShowPrice,
        showBarcode: cellShowBarcode
      }
    : null

  function keepFields() {
    return {
      showName: cellShowName,
      showSku: cellShowSku,
      showPrice: cellShowPrice,
      showBarcode: cellShowBarcode,
      nameSnap: editName
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>
            Cella {row + 1}×{col + 1}
          </DialogTitle>
          <DialogDescription>Cella szerkesztése</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(160px,42%)_1fr] sm:items-start">
          <div className="rounded-md border border-border bg-zinc-50 px-2.5 py-3 sm:sticky sm:top-0">
            <A4CellPreview
              cell={previewCell}
              cellWMm={cellWidthMm}
              cellHMm={cellHeightMm}
            />
            {existing && packHint.barcodeSoftWarning ? (
              <p
                className="mt-2 text-center text-hint text-ink-secondary"
                role="status"
              >
                {packHint.barcodeSoftWarning}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Switch
                id="a4-cell-f-name"
                label="Név"
                checked={cellShowName}
                onCheckedChange={setCellShowName}
              />
              <Switch
                id="a4-cell-f-sku"
                label="SKU"
                checked={cellShowSku}
                onCheckedChange={setCellShowSku}
              />
              <Switch
                id="a4-cell-f-price"
                label="Ár"
                checked={cellShowPrice}
                onCheckedChange={setCellShowPrice}
              />
              <Switch
                id="a4-cell-f-bc"
                label="Vonalkód"
                checked={cellShowBarcode}
                onCheckedChange={setCellShowBarcode}
              />
            </div>

            {existing ? (
              <div className="space-y-2 rounded-md border border-border bg-zinc-50 px-2.5 py-2">
                <FormField
                  label="Termék neve"
                  htmlFor="a4-cell-name"
                  hint={`${editName.length}/${nameMaxChars}`}
                >
                  <Input
                    id="a4-cell-name"
                    value={editName}
                    maxLength={nameMaxChars}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!cellShowName}
                    className="h-8"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Ár (Ft)" htmlFor="a4-cell-price">
                    <Input
                      id="a4-cell-price"
                      type="number"
                      min={0}
                      step={1}
                      value={editPrice}
                      disabled={!cellShowPrice}
                      onChange={(e) =>
                        setEditPrice(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="h-8 tabular-nums"
                    />
                  </FormField>
                  <FormField label="Egység" htmlFor="a4-cell-unit">
                    <Input
                      id="a4-cell-unit"
                      value={editUnit}
                      maxLength={12}
                      disabled={!cellShowPrice}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder="db"
                      className="h-8"
                    />
                  </FormField>
                </div>
                <p className="font-mono text-hint text-ink-secondary">
                  SKU: {existing.skuSnap || '—'} · kód: {existing.barcodeValue}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      onUpdateCell({
                        ...existing,
                        nameSnap: editName,
                        priceGross: editPrice,
                        unitSnap: editUnit.trim() || 'db',
                        showName: cellShowName,
                        showSku: cellShowSku,
                        showPrice: cellShowPrice,
                        showBarcode: cellShowBarcode
                      })
                    }
                  >
                    Mentés a cellába
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => onClear(row, col)}
                  >
                    <X className="size-3.5" aria-hidden />
                    Ürítés
                  </Button>
                </div>
              </div>
            ) : null}

            <FormField label="Keresés" htmlFor="a4-cell-search">
              <Input
                ref={inputRef}
                id="a4-cell-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Név, SKU vagy vonalkód…"
                className="h-8"
                autoComplete="off"
              />
            </FormField>

            <div className="max-h-48 overflow-auto rounded-md border border-border">
              {loading ? (
                <p className="p-3 text-body text-ink-secondary">Keresés…</p>
              ) : err ? (
                <p className="p-3 text-body text-danger" role="alert">
                  {err}
                </p>
              ) : hits.length === 0 ? (
                q.trim().length >= 2 ? (
                  <p className="p-3 text-body text-ink-secondary">
                    Nincs találat.
                  </p>
                ) : (
                  <div className="h-10" aria-hidden />
                )
              ) : (
                <ul className="divide-y divide-border">
                  {hits.map((p) => {
                    const preview = resolveA4PrintableBarcode(
                      {
                        barcode: p.barcode,
                        barcodeInternal: p.barcode_internal
                      },
                      cellWidthMm,
                      source
                    )
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left hover:bg-zinc-50 disabled:opacity-50"
                          disabled={preview.blocked}
                          onClick={() =>
                            onPick(row, col, p, source, keepFields())
                          }
                        >
                          <span className="text-body font-medium text-ink">
                            {p.name}
                          </span>
                          <span className="text-hint text-ink-secondary">
                            {p.sku}
                            {preview.value ? ` · ${preview.value}` : ''}
                          </span>
                          {preview.blocked ? (
                            <span className="text-hint text-danger-ink">
                              {preview.message}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Mégse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
