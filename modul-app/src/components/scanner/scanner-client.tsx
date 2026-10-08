'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ScanBarcode, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  ScannerHandoverDialog,
  type ScannerHandoverItem
} from '@/components/scanner/scanner-handover-dialog'
import { QuoteReadySmsDialog } from '@/components/orders/quote-ready-sms-dialog'
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
import { Input } from '@/components/ui/input'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { quoteRemainingGross } from '@/lib/quotes/payment-labels'
import {
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import {
  markQuotesReadyBulk,
  previewQuoteReadySms
} from '@/lib/scanner/actions'
import type { QuoteReadySmsCandidate } from '@/lib/sms/types'
import type { ScannerLookupOrder } from '@/lib/scanner/types'
import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'
import { cn } from '@/lib/utils'

type ScanMode = 'list' | 'instant'
type InstantAction = 'ready' | 'handover'
type FeedbackTone = 'success' | 'warning' | 'danger' | 'info'

type ScannerClientProps = {
  canWrite: boolean
  hasSmsAddon: boolean
  paymentMethods: PaymentMethodOption[]
}

/** Wedge: gyors billentyűsorozat; ennél hosszabb szünet → új kód. */
const WEDGE_GAP_MS = 80
/** Input mezőbe gépelés után ennyi idle után indít lookupot. */
const INPUT_DEBOUNCE_MS = 300

function showFeedback(tone: FeedbackTone, message: string) {
  if (tone === 'success') toast.success(message)
  else if (tone === 'warning') toast.warning(message)
  else if (tone === 'danger') toast.error(message)
  else toast.message(message)
}

export function ScannerClient({
  canWrite,
  hasSmsAddon,
  paymentMethods
}: ScannerClientProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wedgeBufferRef = useRef('')
  const wedgeLastKeyAtRef = useRef(0)
  const scanningRef = useRef(false)
  const handoverOpenRef = useRef(false)
  const smsDialogOpenRef = useRef(false)
  const bulkLoadingRef = useRef(false)
  const modeRef = useRef<ScanMode>('list')
  const instantActionRef = useRef<InstantAction>('ready')
  const rowsRef = useRef<ScannerLookupOrder[]>([])
  const canWriteRef = useRef(canWrite)
  const hasSmsAddonRef = useRef(hasSmsAddon)

  const [barcodeInput, setBarcodeInput] = useState('')
  const [mode, setMode] = useState<ScanMode>('list')
  const [instantAction, setInstantAction] = useState<InstantAction>('ready')
  const [rows, setRows] = useState<ScannerLookupOrder[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [handoverItems, setHandoverItems] = useState<ScannerHandoverItem[]>([])
  const [smsDialogOpen, setSmsDialogOpen] = useState(false)
  const [smsCandidates, setSmsCandidates] = useState<QuoteReadySmsCandidate[]>(
    []
  )
  const [smsTargetIds, setSmsTargetIds] = useState<string[]>([])
  const [smsClearList, setSmsClearList] = useState(false)

  useEffect(() => {
    handoverOpenRef.current = handoverOpen
  }, [handoverOpen])
  useEffect(() => {
    smsDialogOpenRef.current = smsDialogOpen
  }, [smsDialogOpen])
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
    hasSmsAddonRef.current = hasSmsAddon
  }, [hasSmsAddon])

  useEffect(() => {
    return () => {
      if (inputDebounceRef.current) clearTimeout(inputDebounceRef.current)
    }
  }, [])

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

  async function executeMarkReady(
    quoteIds: string[],
    smsQuoteIds?: string[],
    opts?: { clearList?: boolean; label?: string }
  ) {
    const result = await markQuotesReadyBulk({
      quoteIds,
      smsQuoteIds
    })
    if (result.successCount === 0) {
      showFeedback(
        'danger',
        result.results.find((r) => !r.ok)?.message ??
          'Nem sikerült készre állítani.'
      )
      return
    }

    if (opts?.clearList) {
      setRows([])
      setSelectedIds([])
    }

    const parts = [
      opts?.label ?? `${result.successCount} rendelés készre állítva.`
    ]
    if (result.smsSentCount > 0) {
      parts.push(`${result.smsSentCount} SMS elküldve`)
    }
    if (result.smsFailedCount > 0) {
      parts.push(`${result.smsFailedCount} SMS sikertelen`)
    }

    showFeedback(
      result.smsFailedCount > 0 ? 'warning' : 'success',
      parts.join(' · ')
    )
    setSmsDialogOpen(false)
  }

  async function beginMarkReady(quoteIds: string[], clearList: boolean) {
    setBulkLoading(true)
    try {
      if (!hasSmsAddonRef.current) {
        await executeMarkReady(quoteIds, undefined, { clearList })
        return
      }

      const preview = await previewQuoteReadySms(quoteIds)
      if (!preview.ok) {
        showFeedback('danger', preview.message)
        return
      }
      if (!preview.hasAddon) {
        await executeMarkReady(quoteIds, undefined, { clearList })
        return
      }
      setSmsTargetIds(quoteIds)
      setSmsCandidates(preview.candidates)
      setSmsClearList(clearList)
      setSmsDialogOpen(true)
    } finally {
      setBulkLoading(false)
    }
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
      await beginMarkReady([order.id], false)
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
    if (smsDialogOpenRef.current) {
      showFeedback('warning', 'Előbb zárd be az SMS ablakot.')
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

    await beginMarkReady(
      selectedInProduction.map((r) => r.id),
      true
    )
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
  const hasSelection = selectedIds.length > 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scanner"
        description="Vonalkód → lista → egy művelet. Fókusz nélkül is működik."
      />

      {!canWrite ? (
        <p
          className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink"
          role="status"
        >
          Megtekintő módban csak kereshetsz — státuszmódosítás nem elérhető.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Scanner mód"
          options={[
            { value: 'list', label: 'Lista' },
            { value: 'instant', label: 'Azonnali' }
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'instant' ? (
          <SegmentedControl
            ariaLabel="Azonnali művelet"
            options={[
              { value: 'ready', label: 'Készre' },
              { value: 'handover', label: 'Átadás' }
            ]}
            value={instantAction}
            onChange={setInstantAction}
          />
        ) : null}
      </div>

      <FormField
        label="Vonalkód"
        htmlFor="scanner-barcode"
        hint={scanning ? 'Keresés…' : undefined}
        className="max-w-2xl"
      >
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
      </FormField>

      {mode === 'list' ? (
        <>
          {rows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-hint text-ink-secondary">
                {hasSelection
                  ? `${selectedIds.length} kijelölve · ${rows.length} a listán`
                  : `${rows.length} rendelés a listán`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={bulkLoading}
                  onClick={() => {
                    setRows([])
                    setSelectedIds([])
                  }}
                >
                  Lista törlése
                </Button>
                {hasSelection ? (
                  readyPrimary ? (
                    <>
                      {canMarkReady ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={bulkLoading}
                          onClick={() => void handleMarkReady()}
                        >
                          Gyártás kész ({selectedInProduction.length})
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={!canHandover || bulkLoading}
                        onClick={openHandoverForSelected}
                      >
                        Átadás ({selectedReady.length})
                      </Button>
                    </>
                  ) : (
                    <>
                      {canHandover ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={bulkLoading}
                          onClick={openHandoverForSelected}
                        >
                          Átadás ({selectedReady.length})
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
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
                  )
                ) : null}
              </div>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-10 text-center">
              <ScanBarcode
                className="size-8 text-ink-muted"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="text-body text-ink">Olvasd be az első vonalkódot</p>
              <p className="max-w-sm text-hint text-ink-secondary">
                A beolvasott rendelések itt gyűlnek. Utána egy művelet: gyártás
                kész vagy átadás.
              </p>
            </div>
          ) : (
            <DataTable className="min-w-0">
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell className="w-10 px-2">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={
                        rows.length > 0 && selectedIds.length === rows.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése"
                    />
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Rendelés</DataTableHeaderCell>
                  <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
                  <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Hátralék
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="w-10">
                    <span className="sr-only">Művelet</span>
                  </DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => {
                  const remaining = quoteRemainingGross(
                    row.final_total_gross,
                    row.total_paid
                  )
                  const selected = selectedIds.includes(row.id)
                  return (
                    <DataTableRow
                      key={row.id}
                      className={cn(
                        'hover:bg-subtle/80',
                        selected &&
                          'bg-subtle shadow-[inset_2px_0_0_0_#18181B]'
                      )}
                    >
                      <DataTableCell className="w-10 px-2">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selected}
                          onChange={() => toggleSelect(row.id)}
                          aria-label={`${row.order_number} kijelölése`}
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          href={`/ajanlatok/${row.id}`}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {row.order_number}
                        </Link>
                        {row.project_name ? (
                          <p className="max-w-[180px] truncate text-hint text-ink-secondary">
                            {row.project_name}
                          </p>
                        ) : null}
                      </DataTableCell>
                      <DataTableCell>{row.customer_name}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={quoteStatusTone(row.status)}>
                          {QUOTE_STATUS_LABEL[row.status]}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell align="right">
                        {remaining > 0
                          ? formatQuotePrice(remaining, row.currency)
                          : '—'}
                      </DataTableCell>
                      <DataTableCell className="w-10 px-1">
                        <button
                          type="button"
                          className="inline-flex size-7 items-center justify-center rounded-md text-ink-secondary hover:bg-subtle hover:text-ink"
                          aria-label="Eltávolítás a listáról"
                          onClick={() => removeRows([row.id])}
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          )}
        </>
      ) : (
        <p className="max-w-xl rounded-md border border-border bg-surface px-3 py-2.5 text-body text-ink-secondary">
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

      <QuoteReadySmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        candidates={smsCandidates}
        loading={bulkLoading}
        onConfirm={(smsQuoteIds) => {
          void (async () => {
            setBulkLoading(true)
            try {
              await executeMarkReady(smsTargetIds, smsQuoteIds, {
                clearList: smsClearList
              })
            } finally {
              setBulkLoading(false)
            }
          })()
        }}
      />
    </div>
  )
}

function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange
}: {
  ariaLabel: string
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-7 items-center rounded-[5px] px-2.5 text-hint font-medium transition-colors',
              active
                ? 'bg-ink text-white'
                : 'text-ink-secondary hover:bg-subtle hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
