'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
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
  PANEL_TEXT_IMPORT_EXAMPLES,
  parsePanelTextImport,
  recomputeParsedRow,
  visionLinesToParsedRows,
  type ParsedPanelRow
} from '@/lib/opti/panel-text-import'
import type { VisionParseResult } from '@/lib/opti/parse-panel-image'
import { cn } from '@/lib/utils'

export type OptiTextImportCommitRow = {
  grainMm: number
  crossMm: number
  quantity: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  materialLabel: string
  maxGrainMm: number | null
  maxCrossMm: number | null
  onCommit: (rows: OptiTextImportCommitRow[]) => void
}

type InputMode = 'text' | 'image'
type Step = 'input' | 'preview'
type StatusFilter = 'all' | 'error' | 'warn' | 'ok'

function statusLabel(status: ParsedPanelRow['status']): string {
  if (status === 'ok') return 'OK'
  if (status === 'warn') return 'Figyelem'
  return 'Hiba'
}

export function OptiPanelTextImportDialog({
  open,
  onOpenChange,
  materialLabel,
  maxGrainMm,
  maxCrossMm,
  onCommit
}: Props) {
  const [mode, setMode] = useState<InputMode>('text')
  const [step, setStep] = useState<Step>('input')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<ParsedPanelRow[]>([])
  const [skipErrors, setSkipErrors] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageWarnings, setImageWarnings] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** true = reset / Megszakítás — AbortError ilyenkor csendes. */
  const intentionalAbortRef = useRef(false)
  /** OS file picker nyitva — ne zárja a Radix Dialog a focus veszteség miatt. */
  const pickingFileRef = useRef(false)

  const importOptions = useMemo(
    () => ({ maxGrainMm, maxCrossMm }),
    [maxGrainMm, maxCrossMm]
  )

  // Csak object URL takarítás — abort TILOS itt (megölné az épp indított fetch-et).
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Unmount: szakítsd meg a futó kérést.
  useEffect(() => {
    return () => {
      intentionalAbortRef.current = true
      abortRef.current?.abort()
    }
  }, [])

  function clearPreviewUrl() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  function abortUpload() {
    intentionalAbortRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
  }

  function reset() {
    abortUpload()
    pickingFileRef.current = false
    setMode('text')
    setStep('input')
    setRawText('')
    setRows([])
    setSkipErrors(true)
    setFilter('all')
    setImageBusy(false)
    setImageError(null)
    setImageWarnings([])
    clearPreviewUrl()
    setDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenChange(next: boolean) {
    // File picker / feltöltés közben a dialógus ne záródjon (Radix focus outside).
    if (!next && (imageBusy || pickingFileRef.current)) return
    if (!next) reset()
    onOpenChange(next)
  }

  function openFilePicker() {
    pickingFileRef.current = true
    fileInputRef.current?.click()
    window.setTimeout(() => {
      pickingFileRef.current = false
    }, 60_000)
  }

  function runParse() {
    const parsed = parsePanelTextImport(rawText, importOptions)
    setRows(parsed)
    setSkipErrors(parsed.some((r) => r.status === 'error'))
    setFilter('all')
    setImageWarnings([])
    clearPreviewUrl()
    setStep('preview')
  }

  function isAllowedImageFile(file: File): boolean {
    const mime = (file.type || '').toLowerCase()
    if (
      mime === 'image/jpeg' ||
      mime === 'image/png' ||
      mime === 'image/webp' ||
      mime === 'image/gif'
    ) {
      return true
    }
    // macOS / egyes böngészők üres MIME-et adnak — kiterjesztés alapján
    const name = file.name.toLowerCase()
    return /\.(jpe?g|png|webp|gif)$/.test(name)
  }

  async function processImageFile(file: File) {
    pickingFileRef.current = false
    setImageError(null)
    setImageWarnings([])

    const mime = (file.type || '').toLowerCase()
    if (mime.includes('heic') || mime.includes('heif') || /\.heic$/i.test(file.name)) {
      setImageError('HEIC nem támogatott — mentsd JPG/PNG-ként, majd próbáld újra.')
      return
    }
    if (!isAllowedImageFile(file)) {
      setImageError('Csak képfájl (JPG / PNG / WebP) támogatott.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError('Max 10 MB kép.')
      return
    }

    // Új feltöltés: előző kérés szándékos abort, majd új controller.
    intentionalAbortRef.current = true
    abortRef.current?.abort()
    intentionalAbortRef.current = false
    const ac = new AbortController()
    abortRef.current = ac

    clearPreviewUrl()
    setPreviewUrl(URL.createObjectURL(file))
    setImageBusy(true)

    try {
      const body = new FormData()
      body.append('file', file, file.name || 'upload.jpg')
      const res = await fetch('/api/opti/parse-panel-image', {
        method: 'POST',
        body,
        signal: ac.signal
      })
      const raw = await res.text()
      let data: VisionParseResult & { error?: string }
      try {
        data = JSON.parse(raw) as VisionParseResult & { error?: string }
      } catch {
        throw new Error(
          res.ok
            ? 'Érvénytelen válasz a szervertől.'
            : `Kép feldolgozás sikertelen (${res.status}).`
        )
      }
      if (!res.ok) {
        throw new Error(data.error || 'Kép feldolgozás sikertelen')
      }
      if (!data.lines?.length) {
        setImageError('Nem találtam méretsort a képen.')
        return
      }
      const parsed = visionLinesToParsedRows(data.lines, importOptions)
      setRows(parsed)
      setSkipErrors(parsed.some((r) => r.status === 'error'))
      setFilter('all')
      setImageWarnings(data.warnings ?? [])
      setStep('preview')
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (aborted && intentionalAbortRef.current) return
      if (aborted) {
        setImageError('A kiolvasás megszakadt — próbáld újra.')
        return
      }
      setImageError(
        e instanceof Error ? e.message : 'Kép feldolgozás sikertelen'
      )
    } finally {
      setImageBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateRow(index: number, patch: Partial<ParsedPanelRow>) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        // Kézi javítás → AI soft note-ok törlése; csak dim validáció marad.
        return recomputeParsedRow(
          { ...r, ...patch, issues: [] },
          importOptions
        )
      })
    )
  }

  const okCount = rows.filter((r) => r.status === 'ok').length
  const errorCount = rows.filter((r) => r.status === 'error').length
  const warnCount = rows.filter((r) => r.status === 'warn').length
  const readyCount = rows.filter((r) => r.status !== 'error').length
  const commitCount = skipErrors
    ? readyCount
    : rows.every((r) => r.status !== 'error')
      ? rows.length
      : 0

  const visibleRows = useMemo(() => {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (filter === 'all') return true
        return row.status === filter
      })
  }, [rows, filter])

  function handleCommit() {
    const selected = skipErrors
      ? rows.filter((r) => r.status !== 'error')
      : rows
    if (selected.some((r) => r.status === 'error')) return
    const payload: OptiTextImportCommitRow[] = []
    for (const r of selected) {
      if (r.grainMm == null || r.crossMm == null) continue
      payload.push({
        grainMm: r.grainMm,
        crossMm: r.crossMm,
        quantity: r.quantity
      })
    }
    if (payload.length === 0) return
    onCommit(payload)
    handleOpenChange(false)
  }

  const filterChips: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: `Összes (${rows.length})` },
    { id: 'error', label: `Hiba (${errorCount})` },
    { id: 'warn', label: `Figyelem (${warnCount})` },
    { id: 'ok', label: `OK (${okCount})` }
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {step === 'input' ? 'Panelimport' : 'Import előnézet'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'Csak szál, kereszt és darabszám — él a formról jön.'
              : `Anyag: ${materialLabel} · él: mint a formon`}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['text', 'Szöveg'],
                  ['image', 'Fotó / kép']
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-hint',
                    mode === id
                      ? 'border-ink bg-ink text-white'
                      : 'border-border bg-subtle text-ink-secondary hover:text-ink'
                  )}
                  disabled={imageBusy}
                  onClick={() => {
                    setMode(id)
                    setImageError(null)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'text' ? (
              <>
                <FormField
                  label="Panelek"
                  htmlFor="opti-import-text"
                  hint="Szál Kereszt [Db] — pl. 720 560 2"
                >
                  <Textarea
                    id="opti-import-text"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={10}
                    placeholder={'720 560 2\n800x400 x4\n600 400'}
                    className="font-mono text-[13px]"
                  />
                </FormField>
                <div className="flex flex-wrap gap-1.5">
                  {PANEL_TEXT_IMPORT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="rounded-md border border-border bg-subtle px-2 py-1 text-hint text-ink-secondary hover:bg-canvas hover:text-ink"
                      onClick={() =>
                        setRawText((prev) =>
                          prev.trim() ? `${prev.trimEnd()}\n${ex}` : ex
                        )
                      }
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-hint text-ink-secondary">
                  Fotózd a listát felülről, élesen. JPG / PNG / WebP — kézírás
                  is lehet. Utána te ellenőrzöd az előnézetben.
                </p>
                {/*
                  File input a dialóguson belül, de sr-only + gomb (accessories minta).
                  Radix outside-dismiss le van tiltva fent — különben a file picker
                  bezárja a dialógust mielőtt a POST elindulna.
                */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  disabled={imageBusy}
                    onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void processImageFile(f)
                    else pickingFileRef.current = false
                  }}
                />
                <div
                  role="button"
                  tabIndex={imageBusy ? -1 : 0}
                  className={cn(
                    'flex min-h-[8rem] w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-subtle px-4 py-6 text-center text-body text-ink-secondary transition-colors',
                    !imageBusy && 'cursor-pointer hover:border-ink/40',
                    dragOver && 'border-ink bg-canvas text-ink',
                    imageBusy && 'cursor-wait opacity-60'
                  )}
                  onClick={() => {
                    if (!imageBusy) openFilePicker()
                  }}
                  onKeyDown={(e) => {
                    if (imageBusy) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openFilePicker()
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (imageBusy) return
                    const f = e.dataTransfer.files?.[0]
                    if (f) void processImageFile(f)
                  }}
                >
                  {imageBusy ? (
                    <>
                      <span className="font-medium text-ink">
                        Kiolvassuk a méreteket…
                      </span>
                      <span className="mt-1 text-hint">
                        Kézírásnál ez 20–40 másodperc is lehet. Utána te
                        ellenőrzöd.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-ink">
                        Húzd ide a képet, vagy kattints ide
                      </span>
                      <span className="mt-1 text-hint">
                        JPG / PNG / WebP · max 10 MB
                      </span>
                    </>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={imageBusy}
                    onClick={openFilePicker}
                  >
                    Kép kiválasztása…
                  </Button>
                </div>
                {imageError ? (
                  <p className="text-body text-danger-ink" role="alert">
                    {imageError}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Forrás kép"
                className="max-h-28 rounded-md border border-border object-contain"
              />
            ) : null}
            {imageWarnings.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-hint text-ink-secondary">
                {imageWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-body text-ink-secondary">
              {rows.length} sor · {okCount} OK
              {warnCount ? ` · ${warnCount} figyelem` : ''}
              {errorCount ? ` · ${errorCount} hiba` : ''}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {filterChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 text-hint',
                    filter === chip.id
                      ? 'border-ink bg-ink text-white'
                      : 'border-border bg-subtle text-ink-secondary hover:text-ink'
                  )}
                  onClick={() => setFilter(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {errorCount > 0 ? (
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--color-primary,#18181B)]"
                  checked={skipErrors}
                  onChange={(e) => setSkipErrors(e.target.checked)}
                />
                Hibás sorok kihagyása
              </label>
            ) : null}

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[28rem] text-left text-body">
                <thead className="border-b border-border bg-subtle text-hint text-ink-secondary">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">Szál</th>
                    <th className="px-2 py-1.5 font-medium">Kereszt</th>
                    <th className="px-2 py-1.5 font-medium">Db</th>
                    <th className="px-2 py-1.5 font-medium">Állapot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRows.map(({ row, index }) => {
                    const dimError = row.issues.some(
                      (m) =>
                        m.includes('Kell szál') ||
                        m.includes('0-nál') ||
                        m.includes('max ')
                    )
                    return (
                      <tr key={`${row.sourceLine}-${index}`}>
                        <td className="px-2 py-1 tabular-nums text-ink-muted">
                          {row.sourceLine}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-1',
                            dimError && 'bg-danger-soft/40'
                          )}
                        >
                          <Input
                            value={row.grainMm ?? ''}
                            inputMode="numeric"
                            className="h-8 w-[4.5rem] font-mono"
                            onChange={(e) => {
                              const n = Number.parseInt(e.target.value, 10)
                              updateRow(index, {
                                grainMm: Number.isFinite(n) ? n : null
                              })
                            }}
                          />
                        </td>
                        <td
                          className={cn(
                            'px-2 py-1',
                            dimError && 'bg-danger-soft/40'
                          )}
                        >
                          <Input
                            value={row.crossMm ?? ''}
                            inputMode="numeric"
                            className="h-8 w-[4.5rem] font-mono"
                            onChange={(e) => {
                              const n = Number.parseInt(e.target.value, 10)
                              updateRow(index, {
                                crossMm: Number.isFinite(n) ? n : null
                              })
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.quantity}
                            inputMode="numeric"
                            className="h-8 w-14 font-mono"
                            onChange={(e) => {
                              const n = Number.parseInt(e.target.value, 10)
                              updateRow(index, {
                                quantity:
                                  Number.isFinite(n) && n >= 1 ? n : 1
                              })
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-hint font-medium',
                              row.status === 'ok' && 'bg-subtle text-ink',
                              row.status === 'warn' &&
                                'bg-warning-soft text-warning-ink',
                              row.status === 'error' &&
                                'bg-danger-soft text-danger-ink'
                            )}
                          >
                            {statusLabel(row.status)}
                          </span>
                          {row.issues[0] ? (
                            <p className="mt-0.5 text-[11px] text-warning-ink">
                              {row.issues[0]}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? (
              <p className="text-body text-ink-secondary">
                Nincs beolvasható sor.
              </p>
            ) : visibleRows.length === 0 ? (
              <p className="text-body text-ink-secondary">
                Nincs sor ebben a szűrőben.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (imageBusy) {
                abortUpload()
                setImageBusy(false)
                return
              }
              if (step === 'preview') {
                setStep('input')
                return
              }
              handleOpenChange(false)
            }}
          >
            {imageBusy ? 'Megszakítás' : step === 'preview' ? 'Vissza' : 'Mégse'}
          </Button>
          {step === 'input' && mode === 'text' ? (
            <Button
              type="button"
              disabled={!rawText.trim()}
              onClick={runParse}
            >
              Beolvasás előnézetbe
            </Button>
          ) : null}
          {step === 'preview' ? (
            <Button
              type="button"
              disabled={commitCount === 0}
              onClick={handleCommit}
            >
              {commitCount === 0
                ? 'Nincs hozzáadható sor'
                : `Hozzáadás az Opti listához (${commitCount})`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
