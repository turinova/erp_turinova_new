'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Minus, Plus, Printer, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { LabelAlignmentSchema } from '@/components/labels/label-alignment-schema'
import { ProductLabelSheet } from '@/components/labels/product-label-sheet'
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
import { MenuSelect } from '@/components/ui/menu-select'
import { LABEL_TEMPLATES, type LabelTemplateId } from '@/lib/labels/layout'
import {
  browserPrintStatusLabel,
  mapBrowserPrintError,
  probeBrowserPrint,
  type BrowserPrintDevice,
  type BrowserPrintProbe
} from '@/lib/labels/browser-print-client'
import { printProductLabels } from '@/lib/labels/print-label'
import {
  loadLabelPrintSettingsAction,
  saveLabelPrintSettingsAction
} from '@/lib/labels/print-settings-actions'
import {
  clampLabelOffset,
  LABEL_OFFSET_MAX,
  LABEL_OFFSET_MIN,
  LABEL_OFFSET_STEP
} from '@/lib/labels/print-settings'
import {
  defaultBarcodeSource,
  isScannableOn33x25,
  resolvePrintableBarcode
} from '@/lib/labels/print-policy'
import { isValidEan13 } from '@/lib/barcodes/ean13'
import {
  type LabelBarcodeSource,
  type LabelFields,
  type ProductLabelPayload
} from '@/lib/labels/types'
import { cn } from '@/lib/utils'

type UnitOption = { id: string; name: string; shortform: string }

type Props = {
  open: boolean
  payload: ProductLabelPayload | null
  units: UnitOption[]
  onClose: () => void
  /** Default példányszám (pl. beérkezett qty). */
  initialAmount?: number
}

const FIELD_CHIPS: Array<{ key: keyof LabelFields; label: string }> = [
  { key: 'showName', label: 'Név' },
  { key: 'showSku', label: 'SKU' },
  { key: 'showPrice', label: 'Ár' },
  { key: 'showBarcode', label: 'Vonalkód' }
]

const LEGACY_OFFSET_KEY = 'modul-label-print-offset'

function formatOffsetPair(x: number, y: number): string {
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  return `${fmt(x)} / ${fmt(y)} mm`
}

/** One-shot: ha DB üres (0,0) és van régi localStorage, vedd át draftnak. */
function readLegacyLocalOffset(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(LEGACY_OFFSET_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { x?: number; y?: number }
    const x = clampLabelOffset(Number(parsed.x) || 0)
    const y = clampLabelOffset(Number(parsed.y) || 0)
    if (x === 0 && y === 0) return null
    return { x, y }
  } catch {
    return null
  }
}

function clearLegacyLocalOffset() {
  try {
    localStorage.removeItem(LEGACY_OFFSET_KEY)
  } catch {
    /* ignore */
  }
}

export function ProductLabelPrintDialog({
  open,
  payload,
  units,
  onClose,
  initialAmount = 1
}: Props) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [unit, setUnit] = useState('db')
  const [amount, setAmount] = useState(1)
  const [templateId, setTemplateId] = useState<LabelTemplateId | 'custom'>(
    'full'
  )
  const [fields, setFields] = useState<LabelFields>({
    showName: true,
    showSku: true,
    showBarcode: true,
    showPrice: true
  })
  /** Digits under bars — default off for scan height on 33×25. */
  const [showHumanReadable, setShowHumanReadable] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [savedOffsetX, setSavedOffsetX] = useState(0)
  const [savedOffsetY, setSavedOffsetY] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [canWriteSettings, setCanWriteSettings] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [barcodeSource, setBarcodeSource] =
    useState<LabelBarcodeSource>('auto')
  const [zebraProbe, setZebraProbe] = useState<BrowserPrintProbe | null>(null)
  const [zebraDevice, setZebraDevice] = useState<BrowserPrintDevice | null>(
    null
  )
  const [zebraProbing, setZebraProbing] = useState(false)
  const zebraProbeGen = useRef(0)

  const refreshZebraProbe = useCallback(async (): Promise<BrowserPrintProbe> => {
    const gen = ++zebraProbeGen.current
    setZebraProbing(true)
    try {
      const probe = await probeBrowserPrint()
      if (gen !== zebraProbeGen.current) return probe
      setZebraProbe(probe)
      setZebraDevice(probe.status === 'ok' ? probe.device : null)
      return probe
    } finally {
      if (gen === zebraProbeGen.current) setZebraProbing(false)
    }
  }, [])

  const printResolve = useMemo(() => {
    if (!payload) {
      return null
    }
    return resolvePrintableBarcode(payload, barcodeSource)
  }, [payload, barcodeSource])

  /** Policy-resolved code for preview + print (never overflow CODE128). */
  const barcode = printResolve?.value ?? null
  const hasBarcode = Boolean(barcode)
  const barcodeBlocked =
    Boolean(fields.showBarcode) && Boolean(printResolve?.blocked)
  const hasSupplierCode = Boolean(payload?.barcode?.trim())
  const hasInternalCode = Boolean(payload?.barcodeInternal?.trim())
  const hasValidInternal = Boolean(
    payload?.barcodeInternal?.trim() &&
      isValidEan13(payload.barcodeInternal.trim())
  )
  const supplierScannable = isScannableOn33x25(payload?.barcode)
  const showBarcodePicker =
    hasSupplierCode || hasInternalCode || hasValidInternal
  const settingsDirty =
    offsetX !== savedOffsetX || offsetY !== savedOffsetY
  const hasActiveOffset = offsetX !== 0 || offsetY !== 0

  useEffect(() => {
    if (!open || !payload) return
    const source = defaultBarcodeSource(payload)
    setBarcodeSource(source)
    const resolved = resolvePrintableBarcode(payload, source)
    const bc = Boolean(resolved.value) && !resolved.blocked
    setName(payload.name)
    setPrice(Math.round(payload.priceGross))
    setUnit(payload.unitShortform || 'db')
    setAmount(Math.max(1, Math.round(initialAmount) || 1))
    setTemplateId('full')
    setFields(LABEL_TEMPLATES.find((t) => t.id === 'full')!.fields(bc))
    setShowHumanReadable(false)
    setSettingsOpen(false)
    if (resolved.forcedInternal) {
      setBarcodeSource('internal')
    }
  }, [open, payload, initialAmount])

  // Keep source on internal when policy forces it
  useEffect(() => {
    if (!printResolve?.forcedInternal) return
    if (barcodeSource !== 'internal') setBarcodeSource('internal')
  }, [printResolve?.forcedInternal, barcodeSource])

  // Probe on open + re-probe when tab/window returns (USB unplug while away)
  useEffect(() => {
    if (!open) return
    setZebraProbe(null)
    setZebraDevice(null)
    void refreshZebraProbe()

    let lastAt = 0
    const throttledRefresh = () => {
      const now = Date.now()
      if (now - lastAt < 1500) return
      lastAt = now
      void refreshZebraProbe()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') throttledRefresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', throttledRefresh)
    return () => {
      zebraProbeGen.current += 1
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', throttledRefresh)
    }
  }, [open, refreshZebraProbe])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSettingsLoading(true)
    void (async () => {
      const res = await loadLabelPrintSettingsAction()
      if (cancelled) return
      setSettingsLoading(false)
      if (!res.ok) {
        setOffsetX(0)
        setOffsetY(0)
        setSavedOffsetX(0)
        setSavedOffsetY(0)
        setCanWriteSettings(false)
        return
      }
      setCanWriteSettings(res.canWrite)
      let x = res.settings.offsetXMm
      let y = res.settings.offsetYMm
      // Legacy localStorage → draft, ha tenant még 0,0
      if (x === 0 && y === 0) {
        const legacy = readLegacyLocalOffset()
        if (legacy) {
          x = legacy.x
          y = legacy.y
          toast.message('Korábbi böngésző-illesztés betöltve', {
            description: 'Mentés a Beállításokban — tenant szinten tárolódik.'
          })
        }
      } else {
        clearLegacyLocalOffset()
      }
      setOffsetX(x)
      setOffsetY(y)
      setSavedOffsetX(res.settings.offsetXMm)
      setSavedOffsetY(res.settings.offsetYMm)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const unitOptions = useMemo(() => {
    const opts = units.map((u) => ({
      value: u.shortform,
      label: u.shortform,
      hint: u.name
    }))
    if (unit && !opts.some((o) => o.value === unit)) {
      opts.unshift({ value: unit, label: unit, hint: 'Jelenlegi' })
    }
    return opts
  }, [units, unit])

  /** Payload with policy-resolved code for preview sheet. */
  const effectivePayload = useMemo((): ProductLabelPayload | null => {
    if (!payload) return null
    return {
      ...payload,
      barcode: barcode,
      barcodeInternal: null
    }
  }, [payload, barcode])

  const zebraStatus = zebraProbe ? browserPrintStatusLabel(zebraProbe) : null
  const zebraReady = zebraProbe?.status === 'ok'
  const canPrintBarcode =
    !fields.showBarcode || (hasBarcode && !barcodeBlocked)

  function applyTemplate(id: LabelTemplateId) {
    const tpl = LABEL_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    setTemplateId(id)
    setFields(tpl.fields(hasBarcode && !barcodeBlocked))
  }

  function toggleField(key: keyof LabelFields) {
    if (key === 'showBarcode') {
      if (fields.showBarcode) {
        setTemplateId('custom')
        setFields((f) => ({ ...f, showBarcode: false }))
        return
      }
      if (!hasBarcode) return
    }
    setTemplateId('custom')
    setFields((f) => ({ ...f, [key]: !f[key] }))
  }

  function updateOffset(axis: 'x' | 'y', value: number) {
    const next = clampLabelOffset(value)
    if (axis === 'x') setOffsetX(next)
    else setOffsetY(next)
  }

  function resetOffsetDraft() {
    setOffsetX(0)
    setOffsetY(0)
  }

  async function handleSaveSettings() {
    if (!canWriteSettings) {
      toast.error('Nincs jogosultságod a mentéshez.')
      return
    }
    setSettingsSaving(true)
    try {
      const res = await saveLabelPrintSettingsAction({
        offsetXMm: offsetX,
        offsetYMm: offsetY
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setSavedOffsetX(res.settings.offsetXMm)
      setSavedOffsetY(res.settings.offsetYMm)
      setOffsetX(res.settings.offsetXMm)
      setOffsetY(res.settings.offsetYMm)
      clearLegacyLocalOffset()
      toast.success('Illesztés mentve a céghez.')
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handlePrint(opts?: { method?: 'zebra' | 'html' }) {
    if (!payload || !effectivePayload) return
    if (
      !fields.showName &&
      !fields.showSku &&
      !fields.showBarcode &&
      !fields.showPrice
    ) {
      toast.error('Válassz ki legalább egy mezőt a címkéhez.')
      return
    }
    if (fields.showBarcode && barcodeBlocked) {
      toast.error(
        printResolve?.message ??
          'Nincs olvasható vonalkód a 33×25 címkéhez. Generálj belső EAN-t, vagy kapcsold ki a Vonalkód mezőt.'
      )
      return
    }
    if (fields.showBarcode && barcode && !isScannableOn33x25(barcode)) {
      toast.error(
        'A vonalkód nem fér olvashatóan. Válts belső EAN-re, vagy kapcsold ki a Vonalkód mezőt.'
      )
      return
    }
    const method = opts?.method ?? 'zebra'
    if (settingsDirty) {
      toast.message('Nem mentett illesztés', {
        description:
          'A nyomtatás a jelenlegi (nem mentett) eltolással megy. Mentés: Beállítások.'
      })
    }

    let deviceForPrint = zebraDevice
    if (method === 'zebra') {
      // Fresh probe every print — USB may have been unplugged since last status
      const probe = await refreshZebraProbe()
      if (probe.status !== 'ok') {
        let msg = 'Zebra Browser Print nem elérhető.'
        if (probe.status === 'ssl' || probe.status === 'down') {
          msg = probe.hint
        } else if (probe.status === 'no_default') {
          msg =
            probe.devices.length > 0
              ? 'Nincs default Zebra nyomtató. Browser Print → Default: ZD220.'
              : 'Nincs Zebra nyomtató — csatlakoztasd USB-n, majd Újracsatlakozás.'
        }
        toast.error(msg)
        return
      }
      deviceForPrint = probe.device
    }

    setPrinting(true)
    try {
      const result = await printProductLabels({
        payload: effectivePayload,
        fields,
        productName: name,
        price,
        unitShortform: unit || 'db',
        size: '33x25',
        amount,
        showHumanReadable,
        offsetXMm: offsetX,
        offsetYMm: offsetY,
        barcodeValue: fields.showBarcode ? barcode : null,
        method,
        zebraDevice: deviceForPrint
      })
      if (printResolve?.forcedInternal) {
        toast.message('Belső EAN', {
          description: printResolve.message ?? undefined
        })
      }
      if (result.method === 'zebra') {
        toast.success('Elküldve a Zebra nyomtatóra')
      } else {
        toast.message('HTML nyomtatás', {
          description:
            'Böngészős nyomtatás — a vonalkód kevésbé megbízható, mint ZPL-lel.'
        })
      }
    } catch (err) {
      console.error(err)
      toast.error(mapBrowserPrintError(err))
      // Refresh status so the banner shows disconnected after failed send
      if (method === 'zebra') void refreshZebraProbe()
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Dialog
      open={open && Boolean(payload)}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Címke nyomtatása</DialogTitle>
          <DialogDescription>
            33×25 mm · Zebra ZPL (középre, natív vonalkód). Előnézet tájékoztató.
            Ha a bal szél levág: Beállítások → vízszintes illesztés negatív irányba.
          </DialogDescription>
          {zebraStatus ? (
            <div
              className={cn(
                'mt-1.5 flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]',
                zebraStatus.tone === 'ok' &&
                  'border border-success/30 bg-success-soft text-success-ink',
                zebraStatus.tone === 'warn' &&
                  'border border-warning/40 bg-warning-soft text-warning-ink',
                zebraStatus.tone === 'error' &&
                  'border border-danger/30 bg-danger-soft text-danger-ink'
              )}
            >
              <p className="min-w-0 flex-1">
                {zebraStatus.text}
                {zebraProbe?.status === 'ssl' || zebraProbe?.status === 'down'
                  ? ` — ${zebraProbe.hint}`
                  : zebraProbe?.status === 'no_default' &&
                      zebraProbe.devices.length === 0
                    ? ' — csatlakoztasd USB-n, majd Újracsatlakozás.'
                    : null}
              </p>
              {zebraStatus.tone !== 'ok' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  loading={zebraProbing}
                  disabled={zebraProbing || printing}
                  onClick={() => void refreshZebraProbe()}
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  Újracsatlakozás
                </Button>
              ) : null}
            </div>
          ) : open ? (
            <p className="mt-1.5 text-[12px] text-ink-muted">
              Zebra kapcsolat ellenőrzése…
            </p>
          ) : null}
        </DialogHeader>

        {payload && effectivePayload ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-stone-50 p-5">
              <p className="text-hint text-ink-secondary">
                Előnézet · 33×25 mm · tartalom középen
              </p>
              <div className="overflow-hidden rounded-md border border-border bg-white p-4 shadow-sm">
                <ProductLabelSheet
                  payload={effectivePayload}
                  fields={fields}
                  productName={name}
                  price={price}
                  unitShortform={unit || 'db'}
                  size="33x25"
                  mode="preview"
                  previewScale={9}
                  showHumanReadable={showHumanReadable}
                  barcodeValue={barcode}
                />
              </div>
              <p className="max-w-sm text-center text-[11px] text-ink-muted">
                Az eltolás nem mozgatja az előnézetet — csak a nyomtató
                illesztését. Ár:{' '}
                <span className="font-medium">Ft/{unit || 'db'}</span>.
              </p>
              {printResolve?.forcedInternal && printResolve.message ? (
                <div className="max-w-sm rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-center">
                  <p className="text-[12px] text-warning-ink">
                    {printResolve.message}
                  </p>
                </div>
              ) : null}
              {barcodeBlocked && printResolve?.message ? (
                <div className="max-w-sm space-y-1.5 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-center">
                  <p className="text-[12px] text-danger-ink">
                    {printResolve.message}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFields((f) => ({ ...f, showBarcode: false }))
                      setTemplateId('custom')
                    }}
                  >
                    Címke vonalkód nélkül
                  </Button>
                </div>
              ) : null}
              {!barcodeBlocked &&
              fields.showBarcode &&
              hasBarcode &&
              !hasValidInternal ? (
                <div className="max-w-sm rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-center">
                  <p className="text-[12px] text-warning-ink">
                    Nincs belső EAN a terméken. Érdemes generálni — hosszú
                    gyártói kód később nem fér a 33×25 címkére.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3.5">
              <fieldset className="space-y-1.5">
                <legend className="text-label font-medium text-ink">
                  Sablon
                </legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {LABEL_TEMPLATES.map((tpl) => {
                    const disabled =
                      (tpl.id === 'barcode' && !hasBarcode) ||
                      (tpl.id === 'sku' && !payload?.sku?.trim())
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => applyTemplate(tpl.id)}
                        className={cn(
                          'rounded-md border px-2 py-1.5 text-left transition-colors',
                          templateId === tpl.id
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-surface hover:bg-subtle',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        <span className="block text-[13px] font-medium text-ink">
                          {tpl.label}
                        </span>
                        <span className="block text-[11px] text-ink-muted">
                          {tpl.hint}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {showBarcodePicker ? (
                <fieldset className="space-y-1.5">
                  <legend className="text-label font-medium text-ink">
                    Nyomtatandó kód
                  </legend>
                  <p className="text-[11px] text-ink-muted">
                    33×25 mm: csak EAN vagy rövid CODE128. Hosszú gyártói kód
                    (pl. DT-CZ…) nem fér — belső EAN kell.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: 'auto' as const,
                          label: 'Auto',
                          hint: 'EAN előny'
                        },
                        {
                          id: 'supplier' as const,
                          label: 'Gyártói',
                          hint: hasSupplierCode
                            ? supplierScannable
                              ? (payload!.barcode ?? '').slice(0, 14)
                              : 'Nem fér (33 mm)'
                            : '—'
                        },
                        {
                          id: 'internal' as const,
                          label: 'Belső EAN',
                          hint: hasValidInternal
                            ? (payload!.barcodeInternal ?? '').slice(0, 14)
                            : hasInternalCode
                              ? 'Érvénytelen EAN'
                              : 'Nincs'
                        }
                      ] as const
                    ).map((opt) => {
                      const disabled =
                        (opt.id === 'supplier' &&
                          (!hasSupplierCode || !supplierScannable)) ||
                        (opt.id === 'internal' && !hasValidInternal)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setBarcodeSource(opt.id)
                            const next = resolvePrintableBarcode(
                              payload!,
                              opt.id
                            )
                            if (!fields.showBarcode && next.value) {
                              setFields((f) => ({ ...f, showBarcode: true }))
                            }
                          }}
                          className={cn(
                            'rounded-md border px-2 py-1.5 text-left transition-colors',
                            barcodeSource === opt.id
                              ? 'border-primary bg-primary-soft'
                              : 'border-border bg-surface hover:bg-subtle',
                            disabled && 'cursor-not-allowed opacity-40'
                          )}
                        >
                          <span className="block text-[13px] font-medium text-ink">
                            {opt.label}
                          </span>
                          <span className="block truncate text-[11px] text-ink-muted">
                            {opt.hint}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ) : null}

              <fieldset className="space-y-1.5">
                <legend className="text-label font-medium text-ink">
                  Mezők
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_CHIPS.map(({ key, label }) => {
                    const disabled =
                      key === 'showBarcode' &&
                      !hasBarcode &&
                      !fields.showBarcode
                    const on = fields[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleField(key)}
                        aria-pressed={on}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                          on
                            ? 'border-primary/30 bg-primary text-white'
                            : 'border-border bg-surface text-ink-secondary hover:bg-subtle',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                  {hasBarcode && fields.showBarcode ? (
                    <button
                      type="button"
                      onClick={() => setShowHumanReadable((v) => !v)}
                      aria-pressed={showHumanReadable}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                        showHumanReadable
                          ? 'border-primary/30 bg-primary text-white'
                          : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                      )}
                    >
                      Kód számjegyei
                    </button>
                  ) : null}
                </div>
                {!hasBarcode ? (
                  <p className="text-hint text-ink-muted">
                    Nincs vonalkód a terméken — add meg a törzsadatban.
                  </p>
                ) : (
                  <p className="text-hint text-ink-muted">
                    A számjegyek a sáv alatt alapból ki vannak — több hely a
                    szkennelhető vonalkódnak.
                  </p>
                )}
              </fieldset>

              <FormField label="Termék neve" htmlFor="label-name">
                <Input
                  id="label-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!fields.showName}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Ár (Ft)" htmlFor="label-price">
                  <Input
                    id="label-price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    disabled={!fields.showPrice}
                    onChange={(e) =>
                      setPrice(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="tabular-nums"
                  />
                </FormField>
                <FormField label="Egység" htmlFor="label-unit">
                  <MenuSelect
                    id="label-unit"
                    value={unit}
                    options={unitOptions}
                    onChange={setUnit}
                    allowEmpty={false}
                    disabled={!fields.showPrice}
                  />
                </FormField>
              </div>

              <FormField label="Példány" htmlFor="label-amount">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Kevesebb"
                    disabled={amount <= 1}
                    onClick={() => setAmount((n) => Math.max(1, n - 1))}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>
                  <Input
                    id="label-amount"
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) =>
                      setAmount(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-20 text-center tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Több"
                    onClick={() => setAmount((n) => n + 1)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </FormField>

              {/* Beállítások — alapból zárva */}
              <div className="rounded-md border border-border bg-surface">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-subtle"
                  onClick={() => setSettingsOpen((v) => !v)}
                  aria-expanded={settingsOpen}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">
                      Beállítások
                    </span>
                    {!settingsOpen && hasActiveOffset ? (
                      <span className="mt-0.5 block text-[11px] text-ink-muted tabular-nums">
                        Illesztés: {formatOffsetPair(offsetX, offsetY)}
                        {settingsDirty ? ' · nem mentett' : ''}
                      </span>
                    ) : !settingsOpen ? (
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        Nyomtató illesztés (tenant)
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-hint text-ink-secondary">
                    {settingsOpen ? 'Elrejt' : 'Megnyit'}
                    <ChevronDown
                      className={cn(
                        'size-3.5 transition-transform',
                        settingsOpen && 'rotate-180'
                      )}
                      aria-hidden
                    />
                  </span>
                </button>

                {settingsOpen ? (
                  <div className="space-y-3 border-t border-border px-3 py-3">
                    <p className="text-hint text-ink-muted">
                      Ha a nyomtatott matrica fizikailag csúszik: állítsd az
                      illesztést. A címke tartalma középen marad. Mentés = cég
                      szintű (minden gép).
                    </p>
                    <LabelAlignmentSchema
                      offsetXMm={offsetX}
                      offsetYMm={offsetY}
                    />
                    {settingsLoading ? (
                      <p className="text-hint text-ink-muted">Betöltés…</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            label="Vízszintes"
                            htmlFor="label-off-x"
                          >
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-label="Balra"
                                disabled={!canWriteSettings}
                                onClick={() =>
                                  updateOffset('x', offsetX - LABEL_OFFSET_STEP)
                                }
                              >
                                <Minus className="size-3.5" aria-hidden />
                              </Button>
                              <Input
                                id="label-off-x"
                                type="number"
                                step={LABEL_OFFSET_STEP}
                                min={LABEL_OFFSET_MIN}
                                max={LABEL_OFFSET_MAX}
                                value={offsetX}
                                disabled={!canWriteSettings}
                                onChange={(e) =>
                                  updateOffset(
                                    'x',
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-16 text-center tabular-nums"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-label="Jobbra"
                                disabled={!canWriteSettings}
                                onClick={() =>
                                  updateOffset('x', offsetX + LABEL_OFFSET_STEP)
                                }
                              >
                                <Plus className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          </FormField>
                          <FormField
                            label="Függőleges"
                            htmlFor="label-off-y"
                          >
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-label="Fel"
                                disabled={!canWriteSettings}
                                onClick={() =>
                                  updateOffset('y', offsetY - LABEL_OFFSET_STEP)
                                }
                              >
                                <Minus className="size-3.5" aria-hidden />
                              </Button>
                              <Input
                                id="label-off-y"
                                type="number"
                                step={LABEL_OFFSET_STEP}
                                min={LABEL_OFFSET_MIN}
                                max={LABEL_OFFSET_MAX}
                                value={offsetY}
                                disabled={!canWriteSettings}
                                onChange={(e) =>
                                  updateOffset(
                                    'y',
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-16 text-center tabular-nums"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-label="Le"
                                disabled={!canWriteSettings}
                                onClick={() =>
                                  updateOffset('y', offsetY + LABEL_OFFSET_STEP)
                                }
                              >
                                <Plus className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          </FormField>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canWriteSettings ? (
                            <Button
                              type="button"
                              size="sm"
                              loading={settingsSaving}
                              disabled={!settingsDirty || settingsSaving}
                              onClick={() => void handleSaveSettings()}
                            >
                              Illesztés mentése
                            </Button>
                          ) : (
                            <p className="text-hint text-ink-muted">
                              Csak megtekintés — a mentéshez írási jog kell.
                            </p>
                          )}
                          {hasActiveOffset || settingsDirty ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={!canWriteSettings}
                              onClick={resetOffsetDraft}
                            >
                              Nullázás
                            </Button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={printing}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handlePrint({ method: 'html' })}
            loading={printing}
            disabled={!payload || !canPrintBarcode}
            title="Csak ha a Browser Print nem elérhető"
          >
            HTML nyomtatás
          </Button>
          <Button
            type="button"
            onClick={() => void handlePrint({ method: 'zebra' })}
            loading={printing}
            disabled={!payload || !zebraReady || !canPrintBarcode}
            title={
              !zebraReady
                ? 'Zebra nem kész — Újracsatlakozás vagy HTML nyomtatás'
                : undefined
            }
          >
            <Printer className="size-3.5" aria-hidden />
            Nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
