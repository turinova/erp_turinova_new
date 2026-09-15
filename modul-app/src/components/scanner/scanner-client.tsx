'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

import {
  ScannerHandoverDialog,
  type ScannerHandoverItem
} from '@/components/scanner/scanner-handover-dialog'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  PAYMENT_STATUS_LABEL,
  paymentStatusTone,
  quoteRemainingGross
} from '@/lib/quotes/payment-labels'
import {
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import { markQuotesReadyBulk } from '@/lib/scanner/actions'
import type { ScannerLookupOrder } from '@/lib/scanner/types'
import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'
import { cn } from '@/lib/utils'

type ScanMode = 'list' | 'instant'
type InstantAction = 'ready' | 'handover'
type FeedbackTone = 'success' | 'warning' | 'danger' | 'info'

type ScannerClientProps = {
  canWrite: boolean
  paymentMethods: PaymentMethodOption[]
}

/** Wedge: gyors billentyűsorozat; ennél hosszabb szünet → új kód. */
const WEDGE_GAP_MS = 80
/** Input mezőbe gépelés után ennyi idle után indít lookupot. */
const INPUT_DEBOUNCE_MS = 300

export function ScannerClient({
  canWrite,
  paymentMethods
}: ScannerClientProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wedgeBufferRef = useRef('')
  const wedgeLastKeyAtRef = useRef(0)
  const scanningRef = useRef(false)
  const handoverOpenRef = useRef(false)
  const bulkLoadingRef = useRef(false)
  const modeRef = useRef<ScanMode>('list')
  const instantActionRef = useRef<InstantAction>('ready')
  const rowsRef = useRef<ScannerLookupOrder[]>([])
  const canWriteRef = useRef(canWrite)

  const [barcodeInput, setBarcodeInput] = useState('')
  const [mode, setMode] = useState<ScanMode>('list')
  const [instantAction, setInstantAction] = useState<InstantAction>('ready')
  const [rows, setRows] = useState<ScannerLookupOrder[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [handoverItems, setHandoverItems] = useState<ScannerHandoverItem[]>([])
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone
    message: string
  } | null>(null)

  useEffect(() => {
    handoverOpenRef.current = handoverOpen
  }, [handoverOpen])
  useEffect(() => {
    bulkLoadingRef.current = bulkLoading
  }, [bulkLoading])
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    instantActionRef.current = instantAction
  }, [instantAction])
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])
  useEffect(() => {
    canWriteRef.current = canWrite
  }, [canWrite])

  useEffect(() => {
    return () => {
      if (inputDebounceRef.current) clearTimeout(inputDebounceRef.current)
    }
  }, [])

  function showFeedback(tone: FeedbackTone, message: string) {
    setFeedback({ tone, message })
  }

  function removeRows(ids: string[]) {
    const idSet = new Set(ids)
    setRows((prev) => prev.filter((r) => !idSet.has(r.id)))
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
  }

  async function lookupBarcode(
    barcode: string
  ): Promise<ScannerLookupOrder | null> {
    const res = await fetch(
      `/api/scanner/lookup?barcode=${encodeURIComponent(barcode)}`
    )
    if (res.status === 404) {
      showFeedback('danger', 'Nincs ilyen vonalkód.')
      return null
    }
    if (res.status === 403) {
      showFeedback('danger', 'Nincs jogosultság a scannerhez.')
      return null
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      showFeedback('danger', body?.error ?? 'Hiba a keresés során.')
      return null
    }
    return (await res.json()) as ScannerLookupOrder
  }

  function validateForList(order: ScannerLookupOrder): boolean {
    if (order.status === 'finished') {
      showFeedback('warning', 'Ez a megrendelés már lezárva.')
      return false
    }
    if (order.status === 'cancelled') {
      showFeedback('warning', 'Ez a megrendelés visszavonva.')
      return false
    }
    if (rowsRef.current.some((r) => r.id === order.id)) {
      showFeedback('warning', 'Ez a megrendelés már a listában van.')
      return false
    }
    return true
  }

  async function runInstant(
    order: ScannerLookupOrder,
    action: InstantAction
  ) {
    if (!canWriteRef.current) {
      showFeedback(
        'warning',
        'Csak megtekintési jogod van — nem módosíthatsz.'
      )
      return
    }

    if (action === 'ready') {
      if (order.status !== 'in_production') {
        showFeedback(
          'danger',
          `Csak gyártásban lévő rendelés állítható készre (most: ${QUOTE_STATUS_LABEL[order.status]}).`
        )
        return
      }
      setBulkLoading(true)
      try {
        const result = await markQuotesReadyBulk([order.id])
        if (!result.ok) {
          showFeedback(
            'danger',
            result.results[0]?.message ?? 'Nem sikerült készre állítani.'
          )
          return
        }
        showFeedback('success', `${order.order_number} készre állítva.`)
      } finally {
        setBulkLoading(false)
      }
      return
    }

    if (order.status !== 'ready') {
      showFeedback(
        'danger',
        `Csak kész státuszú rendelés adható át (most: ${QUOTE_STATUS_LABEL[order.status]}).`
      )
      return
    }

    const remaining = quoteRemainingGross(
      order.final_total_gross,
      order.total_paid
    )
    setHandoverItems([
      {
        id: order.id,
        orderNumber: order.order_number,
        remaining
      }
    ])
    setHandoverOpen(true)
  }

  const handleBarcodeScan = useCallback(async (raw: string) => {
    const barcode = normalizeScannerBarcode(raw)
    if (!barcode) return
    if (scanningRef.current || bulkLoadingRef.current) return
    if (handoverOpenRef.current) {
      showFeedback('warning', 'Előbb zárd be az átadás ablakot.')
      return
    }

    scanningRef.current = true
    setScanning(true)
    setBarcodeInput('')
    wedgeBufferRef.current = ''

    try {
      const order = await lookupBarcode(barcode)
      if (!order) return

      if (modeRef.current === 'instant') {
        await runInstant(order, instantActionRef.current)
        return
      }

      if (!validateForList(order)) return

      setRows((prev) => [...prev, order])
      setSelectedIds((prev) =>
        prev.includes(order.id) ? prev : [...prev, order.id]
      )
      setFeedback(null)
    } catch {
      showFeedback('danger', 'Hiba a keresés során.')
    } finally {
      scanningRef.current = false
      setScanning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs for live state
  }, [])

  /** Globális wedge + beillesztés: fókusz nélkül is. */
  useEffect(() => {
    function isForeignEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      if (target === inputRef.current) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true
      }
      if (target.isContentEditable) return true
      return false
    }

    function submitCode(raw: string) {
      const code = normalizeScannerBarcode(raw)
      if (!code) return
      wedgeBufferRef.current = ''
      if (inputDebounceRef.current) {
        clearTimeout(inputDebounceRef.current)
        inputDebounceRef.current = null
      }
      void handleBarcodeScan(code)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (handoverOpenRef.current) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isForeignEditable(e.target)) return

      const focusedOnScannerInput = e.target === inputRef.current

      if (e.key === 'Enter') {
        const fromInput = focusedOnScannerInput
          ? inputRef.current?.value ?? ''
          : ''
        const code = fromInput || wedgeBufferRef.current
        if (!normalizeScannerBarcode(code)) return
        e.preventDefault()
        submitCode(code)
        return
      }

      if (e.key.length !== 1) return
      if (e.key === ' ') return

      // Scanner input: natív onChange / onPaste kezeli
      if (focusedOnScannerInput) return

      const now = Date.now()
      if (now - wedgeLastKeyAtRef.current > WEDGE_GAP_MS) {
        wedgeBufferRef.current = ''
      }
      wedgeLastKeyAtRef.current = now
      wedgeBufferRef.current += e.key
      setBarcodeInput(normalizeScannerBarcode(wedgeBufferRef.current))
      e.preventDefault()
    }

    function onPaste(e: ClipboardEvent) {
      if (handoverOpenRef.current) return
      // A mező saját onPaste-je kezeli
      if (e.target === inputRef.current) return
      if (isForeignEditable(e.target)) return

      const text = e.clipboardData?.getData('text') ?? ''
      const code = normalizeScannerBarcode(text)
      if (!code) return

      e.preventDefault()
      setBarcodeInput(code)
      submitCode(code)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('paste', onPaste, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('paste', onPaste, true)
    }
  }, [handleBarcodeScan])

  function onInputChange(value: string) {
    const normalized = normalizeScannerBarcode(value)
    setBarcodeInput(normalized)
    wedgeBufferRef.current = normalized

    if (inputDebounceRef.current) clearTimeout(inputDebounceRef.current)
    inputDebounceRef.current = setTimeout(() => {
      if (normalized.trim().length > 0) {
        void handleBarcodeScan(normalized)
      }
    }, INPUT_DEBOUNCE_MS)
  }

  function onInputPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    const code = normalizeScannerBarcode(text)
    if (!code) return
    e.preventDefault()
    setBarcodeInput(code)
    if (inputDebounceRef.current) {
      clearTimeout(inputDebounceRef.current)
      inputDebounceRef.current = null
    }
    void handleBarcodeScan(code)
  }

  const selectedRows = rows.filter((r) => selectedIds.includes(r.id))
  const selectedInProduction = selectedRows.filter(
    (r) => r.status === 'in_production'
  )
  const selectedReady = selectedRows.filter((r) => r.status === 'ready')

  async function handleMarkReady() {
    if (!canWrite) {
      showFeedback(
        'warning',
        'Csak megtekintési jogod van — nem módosíthatsz.'
      )
      return
    }
    if (selectedInProduction.length === 0) {
      showFeedback('danger', 'Nincs gyártásban lévő kijelölt rendelés.')
      return
    }

    setBulkLoading(true)
    try {
      const result = await markQuotesReadyBulk(
        selectedInProduction.map((r) => r.id)
      )
      const skipped =
        selectedRows.length - selectedInProduction.length + result.failCount

      if (result.successCount === 0) {
        showFeedback(
          'danger',
          result.results.find((r) => !r.ok)?.message ??
            'Nem sikerült készre állítani.'
        )
        return
      }

      setRows([])
      setSelectedIds([])

      if (skipped > 0) {
        showFeedback(
          'warning',
          `${result.successCount} / ${selectedRows.length} készre állítva. ${skipped} kihagyva.`
        )
      } else {
        showFeedback(
          'success',
          `${result.successCount} rendelés készre állítva.`
        )
      }
    } finally {
      setBulkLoading(false)
    }
  }

  function openHandoverForSelected() {
    if (!canWrite) {
      showFeedback(
        'warning',
        'Csak megtekintési jogod van — nem módosíthatsz.'
      )
      return
    }
    if (selectedReady.length === 0) {
      showFeedback('danger', 'Nincs kész státuszú kijelölt rendelés.')
      return
    }

    const skipped = selectedRows.length - selectedReady.length
    if (skipped > 0) {
      showFeedback(
        'warning',
        `Csak ${selectedReady.length} kész rendelés kerül átadásra. ${skipped} kihagyva.`
      )
    }

    setHandoverItems(
      selectedReady.map((r) => ({
        id: r.id,
        orderNumber: r.order_number,
        remaining: quoteRemainingGross(r.final_total_gross, r.total_paid)
      }))
    )
    setHandoverOpen(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleSelectAll() {
    if (selectedIds.length === rows.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(rows.map((r) => r.id))
    }
  }

  const currency = rows[0]?.currency ?? 'HUF'
  const readyPrimary =
    mode === 'list' &&
    selectedReady.length > 0 &&
    selectedInProduction.length === 0
  const canHandover =
    mode === 'list' && selectedReady.length > 0 && canWrite
  const canMarkReady =
    mode === 'list' && selectedInProduction.length > 0 && canWrite

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 text-ink">Scanner</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Olvasd be a rendelés vonalkódját — fókusz nélkül is működik.
        </p>
      </div>

      {!canWrite ? (
        <p
          className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink"
          role="status"
        >
          Megtekintő módban csak kereshetsz — státuszmódosítás nem elérhető.
        </p>
      ) : null}

      {feedback ? (
        <p
          className={cn(
            'max-w-xl rounded-md border px-3 py-2 text-body',
            feedback.tone === 'success' &&
              'border-success/30 bg-success-soft text-success-ink',
            feedback.tone === 'warning' &&
              'border-warning/30 bg-warning-soft text-warning-ink',
            feedback.tone === 'danger' &&
              'border-danger/30 bg-danger-soft text-danger-ink',
            feedback.tone === 'info' &&
              'border-border bg-subtle text-ink-secondary'
          )}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <ModeChip
          active={mode === 'list'}
          onClick={() => setMode('list')}
          label="Lista"
        />
        <ModeChip
          active={mode === 'instant'}
          onClick={() => setMode('instant')}
          label="Azonnali"
        />
        {mode === 'instant' ? (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <ModeChip
              active={instantAction === 'ready'}
              onClick={() => setInstantAction('ready')}
              label="Készre"
            />
            <ModeChip
              active={instantAction === 'handover'}
              onClick={() => setInstantAction('handover')}
              label="Átadás"
            />
          </>
        ) : null}
      </div>

      <div className="max-w-xl space-y-1.5">
        <label htmlFor="scanner-barcode" className="text-label text-ink">
          Vonalkód
        </label>
        <Input
          ref={inputRef}
          id="scanner-barcode"
          value={barcodeInput}
          disabled={scanning || bulkLoading}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Scannelj vagy írd be…"
          className="h-10 font-mono text-[15px]"
          onChange={(e) => onInputChange(e.target.value)}
          onPaste={onInputPaste}
        />
        {scanning ? (
          <p className="text-hint text-ink-secondary">Keresés…</p>
        ) : null}
      </div>

      {mode === 'list' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-hint text-ink-secondary">
              {rows.length === 0
                ? 'Még nincs beolvasott rendelés.'
                : `${rows.length} rendelés a listán · ${selectedIds.length} kijelölve`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {rows.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={bulkLoading}
                  onClick={() => {
                    setRows([])
                    setSelectedIds([])
                    setFeedback(null)
                  }}
                >
                  Lista törlése
                </Button>
              ) : null}
              {readyPrimary ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canMarkReady || bulkLoading}
                    onClick={() => void handleMarkReady()}
                  >
                    Gyártás kész
                    {selectedInProduction.length > 0
                      ? ` (${selectedInProduction.length})`
                      : ''}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canHandover || bulkLoading}
                    onClick={openHandoverForSelected}
                  >
                    Átadás
                    {selectedReady.length > 0
                      ? ` (${selectedReady.length})`
                      : ''}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canHandover || bulkLoading}
                    onClick={openHandoverForSelected}
                  >
                    Átadás
                    {selectedReady.length > 0
                      ? ` (${selectedReady.length})`
                      : ''}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canMarkReady || bulkLoading}
                    loading={bulkLoading && canMarkReady}
                    onClick={() => void handleMarkReady()}
                  >
                    Gyártás kész
                    {selectedInProduction.length > 0
                      ? ` (${selectedInProduction.length})`
                      : ''}
                  </Button>
                </>
              )}
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[720px] border-collapse text-left text-body">
                <thead>
                  <tr className="border-b border-border bg-subtle">
                    <th className="w-10 px-2 py-2">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={
                          rows.length > 0 &&
                          selectedIds.length === rows.length
                        }
                        onChange={toggleSelectAll}
                        aria-label="Összes kijelölése"
                      />
                    </th>
                    <th className="px-2 py-2 text-label font-semibold text-ink">
                      Rendelés
                    </th>
                    <th className="px-2 py-2 text-label font-semibold text-ink">
                      Ügyfél
                    </th>
                    <th className="px-2 py-2 text-label font-semibold text-ink">
                      Státusz
                    </th>
                    <th className="px-2 py-2 text-label font-semibold text-ink">
                      Fizetés
                    </th>
                    <th className="px-2 py-2 text-right text-label font-semibold text-ink">
                      Hátralék
                    </th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const remaining = quoteRemainingGross(
                      row.final_total_gross,
                      row.total_paid
                    )
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-b-0 hover:bg-subtle/60"
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            aria-label={`${row.order_number} kijelölése`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Link
                            href={`/ajanlatok/${row.id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {row.order_number}
                          </Link>
                          {row.project_name ? (
                            <p className="text-hint text-ink-secondary truncate max-w-[180px]">
                              {row.project_name}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-ink">
                          {row.customer_name}
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusBadge tone={quoteStatusTone(row.status)}>
                            {QUOTE_STATUS_LABEL[row.status]}
                          </StatusBadge>
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusBadge
                            tone={paymentStatusTone(row.payment_status)}
                          >
                            {PAYMENT_STATUS_LABEL[row.payment_status]}
                          </StatusBadge>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                          {remaining > 0
                            ? formatQuotePrice(remaining, row.currency)
                            : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-secondary hover:bg-subtle hover:text-ink"
                            aria-label="Eltávolítás a listáról"
                            onClick={() => removeRows([row.id])}
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <p className="max-w-xl text-body text-ink-secondary">
          {instantAction === 'ready'
            ? 'Minden beolvasás azonnal készre állítja a gyártásban lévő rendelést.'
            : 'Minden beolvasás átadást indít a kész rendelésnél (hátralék esetén egy megerősítő ablak).'}
        </p>
      )}

      <ScannerHandoverDialog
        open={handoverOpen}
        onOpenChange={setHandoverOpen}
        items={handoverItems}
        currency={currency}
        paymentMethods={paymentMethods}
        onSuccess={(_successIds, summary) => {
          setRows([])
          setSelectedIds([])
          if (summary) {
            showFeedback(summary.tone, summary.message)
          }
        }}
      />
    </div>
  )
}

function ModeChip({
  active,
  onClick,
  label
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-md border px-2.5 text-hint font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
      )}
    >
      {label}
    </button>
  )
}
