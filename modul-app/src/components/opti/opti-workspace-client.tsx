'use client'

import { ScanSearch } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { MaterialPreviewColumn } from '@/components/opti/material-preview-column'
import {
  OptiCustomerStrip,
  type OptiCustomerDraft
} from '@/components/opti/opti-customer-strip'
import {
  PartnerOptiSaveStrip,
  type PartnerOptiCustomerSnapshot
} from '@/components/opti/partner-opti-save-strip'
import { OptiQuoteStrip } from '@/components/opti/opti-quote-strip'
import { OptiResultsStrip } from '@/components/opti/opti-results-strip'
import { PanelsTable } from '@/components/opti/panels-table'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { OptiCuttingFeeConfig } from '@/lib/cutting-fees/queries'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import { buildOptiQuote } from '@/lib/opti/build-opti-quote'
import {
  buildOptimizeRequest,
  summarizeOptimizeResults,
  type OptiRunResult
} from '@/lib/opti/build-optimize-request'
import {
  clearOptiSession,
  readOptiSession,
  sanitizeOptiSessionPanels,
  writeOptiSession,
  type OptiSessionCustomer
} from '@/lib/opti/opti-session'
import { createPanelDraft, type OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { OptimizationResult } from '@/lib/opti/optimization-types'
import {
  formatEdgeMaterialLabel,
  maxCrossMm,
  maxGrainMm,
  type OptiEdgeMaterialOption,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'
import type { QuoteForOptiEdit } from '@/lib/quotes/opti-edit'

type OptiWorkspaceClientProps = {
  tenantId: string
  sheetMaterials: OptiSheetMaterialOption[]
  edgeMaterials: OptiEdgeMaterialOption[]
  cuttingFee: OptiCuttingFeeConfig | null
  customers: OptiCustomerOption[]
  initialEdit?: QuoteForOptiEdit | null
  editLoadError?: string | null
  /** Partner portal: fixed customer from profile, no staff picker. */
  mode?: 'staff' | 'partner'
  partnerCustomer?: PartnerOptiCustomerSnapshot | null
  companyLabel?: string | null
  description?: string
}

type FormErrors = {
  material?: string
  grain?: string
  cross?: string
  quantity?: string
  marking?: string
}

export function OptiWorkspaceClient({
  tenantId,
  sheetMaterials,
  edgeMaterials,
  cuttingFee,
  customers,
  initialEdit = null,
  editLoadError = null,
  mode = 'staff',
  partnerCustomer = null,
  companyLabel = null,
  description
}: OptiWorkspaceClientProps) {
  const grainInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const shouldScrollToResultsRef = useRef(false)
  const sessionHydratedRef = useRef(false)
  const [sessionReady, setSessionReady] = useState(false)
  const isPartner = mode === 'partner'
  const sessionMode = isPartner ? 'partner' : 'staff'

  const isEditMode = Boolean(initialEdit?.editable)
  const editingQuoteId = isEditMode ? initialEdit!.id : null
  const persistSession = Boolean(tenantId) && !isEditMode

  const headerDescription =
    description ??
    (isEditMode
      ? 'Szerkesztés: a panelek betöltve. Futtasd az Optimalizálást, majd frissítsd az árajánlatot.'
      : 'Anyagot ritkán váltasz — a méreteket egymás után adod meg.')

  const [panels, setPanels] = useState<OptiPanelDraft[]>(() =>
    isEditMode ? initialEdit!.panels : []
  )
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OptiPanelDraft | null>(null)
  const [optiResult, setOptiResult] = useState<OptiRunResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optiError, setOptiError] = useState<string | null>(null)

  const [sheetMaterialId, setSheetMaterialId] = useState('')
  const [changingMaterial, setChangingMaterial] = useState(false)
  const [grainRaw, setGrainRaw] = useState('')
  const [crossRaw, setCrossRaw] = useState('')
  const [quantityRaw, setQuantityRaw] = useState('1')
  const [marking, setMarking] = useState('')
  const [edgeAId, setEdgeAId] = useState('')
  const [edgeBId, setEdgeBId] = useState('')
  const [edgeCId, setEdgeCId] = useState('')
  const [edgeDId, setEdgeDId] = useState('')
  const [edgeAroundId, setEdgeAroundId] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [sessionCustomer, setSessionCustomer] =
    useState<OptiCustomerDraft | null>(null)
  const [sessionProjectName, setSessionProjectName] = useState('')

  useEffect(() => {
    if (!persistSession) {
      setSessionReady(true)
      return
    }
    if (sessionHydratedRef.current) return
    sessionHydratedRef.current = true

    const saved = readOptiSession(tenantId, sessionMode)
    if (saved) {
      const { panels: validPanels, dropped } = sanitizeOptiSessionPanels(
        saved.panels,
        sheetMaterials,
        edgeMaterials
      )
      if (validPanels.length > 0) setPanels(validPanels)
      if (
        saved.sheetMaterialId &&
        sheetMaterials.some((m) => m.id === saved.sheetMaterialId)
      ) {
        setSheetMaterialId(saved.sheetMaterialId)
      }
      if (!isPartner && saved.customer?.name?.trim()) {
        setSessionCustomer(saved.customer as OptiCustomerDraft)
      }
      if (saved.projectName.trim()) {
        setSessionProjectName(saved.projectName)
      }
      if (dropped > 0) {
        toast.message(
          `${dropped} mentett panel kihagyva (törölt anyag vagy élzáró).`
        )
      }
    }
    setSessionReady(true)
  }, [
    persistSession,
    tenantId,
    sessionMode,
    sheetMaterials,
    edgeMaterials,
    isPartner
  ])

  useEffect(() => {
    if (!persistSession || !sessionReady) return
    writeOptiSession(tenantId, sessionMode, {
      v: 1,
      panels,
      sheetMaterialId,
      customer: isPartner
        ? null
        : ((sessionCustomer as OptiSessionCustomer | null) ?? null),
      projectName: sessionProjectName
    })
  }, [
    persistSession,
    sessionReady,
    tenantId,
    sessionMode,
    panels,
    sheetMaterialId,
    sessionCustomer,
    sessionProjectName,
    isPartner
  ])

  function handleSessionClearedAfterSave() {
    if (!tenantId) return
    clearOptiSession(tenantId, sessionMode)
    setSessionCustomer(null)
    setSessionProjectName('')
  }

  const handleSessionCustomerChange = useCallback(
    (draft: OptiCustomerDraft, projectName: string) => {
      setSessionCustomer(draft)
      setSessionProjectName(projectName)
    },
    []
  )

  const selectedMaterial = useMemo(
    () => sheetMaterials.find((m) => m.id === sheetMaterialId) ?? null,
    [sheetMaterials, sheetMaterialId]
  )

  const quoteResult = useMemo(() => {
    if (!optiResult) return null
    return buildOptiQuote({
      optiResult,
      panels,
      sheetMaterials,
      edgeMaterials,
      cuttingFee
    })
  }, [optiResult, panels, sheetMaterials, edgeMaterials, cuttingFee])

  useEffect(() => {
    if (!optiResult || !shouldScrollToResultsRef.current) return
    shouldScrollToResultsRef.current = false
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    resultsRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    })
  }, [optiResult])

  const sheetsByManufacturer = useMemo(() => {
    const map = new Map<string, OptiSheetMaterialOption[]>()
    for (const material of sheetMaterials) {
      const key = material.manufacturer_name
      const list = map.get(key)
      if (list) list.push(material)
      else map.set(key, [material])
    }
    return Array.from(map.entries())
  }, [sheetMaterials])

  const maxGrain = selectedMaterial ? maxGrainMm(selectedMaterial) : null
  const maxCross = selectedMaterial ? maxCrossMm(selectedMaterial) : null

  const grainHint =
    selectedMaterial && maxGrain !== null && !errors.grain
      ? `Max: ${maxGrain} mm (${selectedMaterial.length_mm} − ${selectedMaterial.trim_left_mm} − ${selectedMaterial.trim_right_mm})`
      : undefined
  const crossHint =
    selectedMaterial && maxCross !== null && !errors.cross
      ? `Max: ${maxCross} mm (${selectedMaterial.width_mm} − ${selectedMaterial.trim_top_mm} − ${selectedMaterial.trim_bottom_mm})`
      : undefined

  /** Main-app parity: ha > max, a mező értéke a max lesz. */
  function clampDimensionRaw(raw: string, maxMm: number | null): string {
    const trimmed = raw.trim()
    if (!trimmed) return raw
    const num = Number.parseFloat(trimmed.replace(',', '.'))
    if (!Number.isFinite(num) || num <= 0) return raw
    if (maxMm !== null && num > maxMm) return String(maxMm)
    // Egész mm a mentéshez — tizedesből is egészre kerekítünk lefelé csak clampnál nem;
    // gépelés közben engedjük a nyers stringet, ha ≤ max.
    return raw
  }

  function clampQuantityRaw(raw: string): string {
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return digits
    const num = Number.parseInt(digits, 10)
    if (!Number.isFinite(num) || num < 1) return digits === '0' ? '1' : digits
    return String(num)
  }

  function applyMaterialDimensionClamp(material: OptiSheetMaterialOption) {
    const gMax = maxGrainMm(material)
    const cMax = maxCrossMm(material)
    setGrainRaw((prev) => clampDimensionRaw(prev, gMax))
    setCrossRaw((prev) => clampDimensionRaw(prev, cMax))
  }

  const edgeOptions = useMemo(() => {
    const hasFavourites = edgeMaterials.some((e) => e.favourite_priority !== null)
    return edgeMaterials.map((edge) => ({
      value: edge.id,
      label: `${edge.favourite_priority !== null ? '★ ' : ''}${formatEdgeMaterialLabel(edge)}`,
      ...(hasFavourites
        ? {
            group:
              edge.favourite_priority !== null ? 'Kedvencek' : 'Többi élzáró'
          }
        : {})
    }))
  }, [edgeMaterials])

  const grainMm = Number.parseInt(grainRaw, 10)
  const crossMm = Number.parseInt(crossRaw, 10)
  const previewGrain =
    Number.isFinite(grainMm) && grainMm > 0 ? grainMm : null
  const previewCross =
    Number.isFinite(crossMm) && crossMm > 0 ? crossMm : null

  function edgeLabel(id: string): string {
    if (!id) return ''
    const edge = edgeMaterials.find((e) => e.id === id)
    return edge ? formatEdgeMaterialLabel(edge) : ''
  }

  function invalidateOpti() {
    setOptiResult(null)
    setOptiError(null)
  }

  function clearDimensionAndEdges() {
    setGrainRaw('')
    setCrossRaw('')
    setQuantityRaw('1')
    setMarking('')
    setEdgeAId('')
    setEdgeBId('')
    setEdgeCId('')
    setEdgeDId('')
    setEdgeAroundId('')
    setErrors({})
  }

  function focusGrain() {
    window.setTimeout(() => {
      grainInputRef.current?.focus()
      grainInputRef.current?.select()
    }, 0)
  }

  function resolveAroundId(a: string, b: string, c: string, d: string) {
    if (a && a === b && a === c && a === d) return a
    return ''
  }

  function loadPanelForEdit(panel: OptiPanelDraft) {
    setEditingPanelId(panel.id)
    setChangingMaterial(false)
    setSheetMaterialId(panel.sheetMaterialId)
    setGrainRaw(String(panel.grainMm))
    setCrossRaw(String(panel.crossMm))
    setQuantityRaw(String(panel.quantity))
    setMarking(panel.marking)
    setEdgeAId(panel.edgeAId ?? '')
    setEdgeBId(panel.edgeBId ?? '')
    setEdgeCId(panel.edgeCId ?? '')
    setEdgeDId(panel.edgeDId ?? '')
    setEdgeAroundId(
      resolveAroundId(
        panel.edgeAId ?? '',
        panel.edgeBId ?? '',
        panel.edgeCId ?? '',
        panel.edgeDId ?? ''
      )
    )
    setErrors({})
    focusGrain()
  }

  function cancelEdit() {
    setEditingPanelId(null)
    clearDimensionAndEdges()
    focusGrain()
  }

  function selectMaterial(id: string) {
    const prevId = sheetMaterialId
    setSheetMaterialId(id)
    setChangingMaterial(false)
    setErrors((prev) => ({ ...prev, material: undefined }))

    const material = sheetMaterials.find((m) => m.id === id) ?? null

    if (id && id !== prevId && !editingPanelId) {
      clearDimensionAndEdges()
    } else if (material && id && id !== prevId && editingPanelId) {
      // Szerkesztés közben anyagváltás: méretek clamp az új maxra
      applyMaterialDimensionClamp(material)
      setErrors((prev) => ({
        ...prev,
        grain: undefined,
        cross: undefined
      }))
    }

    if (id) {
      focusGrain()
    }
  }

  function handleAroundChange(value: string) {
    setEdgeAroundId(value)
    if (value) {
      setEdgeAId(value)
      setEdgeBId(value)
      setEdgeCId(value)
      setEdgeDId(value)
    }
  }

  function setEdge(
    side: 'a' | 'b' | 'c' | 'd',
    value: string
  ) {
    if (side === 'a') setEdgeAId(value)
    if (side === 'b') setEdgeBId(value)
    if (side === 'c') setEdgeCId(value)
    if (side === 'd') setEdgeDId(value)

    // Egyedi él → Körbe helper ne legyen félrevezető
    setEdgeAroundId((around) => {
      if (!around) return around
      const next = {
        a: side === 'a' ? value : edgeAId,
        b: side === 'b' ? value : edgeBId,
        c: side === 'c' ? value : edgeCId,
        d: side === 'd' ? value : edgeDId
      }
      const allSame =
        next.a === around &&
        next.b === around &&
        next.c === around &&
        next.d === around
      return allSame ? around : ''
    })
  }

  function handleSavePanel() {
    const nextErrors: FormErrors = {}

    if (!selectedMaterial) {
      nextErrors.material = 'Válassz táblás anyagot.'
      setChangingMaterial(true)
    }

    const grain = Number.parseInt(grainRaw, 10)
    const cross = Number.parseInt(crossRaw, 10)
    const quantity = Number.parseInt(quantityRaw, 10)

    if (!Number.isFinite(grain) || grain <= 0) {
      nextErrors.grain = 'Adj meg 0-nál nagyobb méretet.'
    } else if (maxGrain !== null && grain > maxGrain) {
      nextErrors.grain = `A max. ${maxGrain} mm.`
    }

    if (!Number.isFinite(cross) || cross <= 0) {
      nextErrors.cross = 'Adj meg 0-nál nagyobb méretet.'
    } else if (maxCross !== null && cross > maxCross) {
      nextErrors.cross = `A max. ${maxCross} mm.`
    }

    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
      nextErrors.quantity = 'A darabszám legalább 1 legyen (egész szám).'
    }

    if (marking.trim().length > 50) {
      nextErrors.marking = 'A jelölés legfeljebb 50 karakter.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    if (!selectedMaterial) return

    const payload = {
      sheetMaterialId: selectedMaterial.id,
      sheetMaterialName: selectedMaterial.name,
      grainMm: grain,
      crossMm: cross,
      quantity,
      marking: marking.trim().slice(0, 50),
      edgeAId,
      edgeBId,
      edgeCId,
      edgeDId,
      edgeALabel: edgeLabel(edgeAId),
      edgeBLabel: edgeLabel(edgeBId),
      edgeCLabel: edgeLabel(edgeCId),
      edgeDLabel: edgeLabel(edgeDId)
    }

    if (editingPanelId) {
      setPanels((prev) =>
        prev.map((p) =>
          p.id === editingPanelId
            ? {
                ...p,
                ...payload,
                edgeAId: payload.edgeAId || null,
                edgeBId: payload.edgeBId || null,
                edgeCId: payload.edgeCId || null,
                edgeDId: payload.edgeDId || null,
                marking: payload.marking.trim()
              }
            : p
        )
      )
      setEditingPanelId(null)
    } else {
      setPanels((prev) => [...prev, createPanelDraft(payload)])
    }

    invalidateOpti()
    clearDimensionAndEdges()
    focusGrain()
  }

  function handleDelete() {
    if (!deleteTarget) return
    if (editingPanelId === deleteTarget.id) {
      setEditingPanelId(null)
      clearDimensionAndEdges()
    }
    setPanels((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    invalidateOpti()
  }

  async function handleOptimize() {
    if (panels.length === 0 || isOptimizing) return
    setIsOptimizing(true)
    setOptiError(null)
    try {
      const body = buildOptimizeRequest(panels, sheetMaterials)
      if (body.materials.length === 0) {
        setOptiError(
          'Nincs érvényes táblás anyag a panelekhez. Válassz újra anyagot.'
        )
        return
      }
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          algorithm: 'ensemble',
          sortStrategy: 'height'
        })
      })
      const data = (await response.json()) as
        | OptimizationResult[]
        | { error?: string }

      if (!response.ok) {
        setOptiError(
          !Array.isArray(data) && data.error
            ? data.error
            : 'Az optimalizálás sikertelen.'
        )
        return
      }

      if (!Array.isArray(data)) {
        setOptiError('Érvénytelen válasz az optimalizálástól.')
        return
      }

      shouldScrollToResultsRef.current = true
      setOptiResult(summarizeOptimizeResults(data))
    } catch {
      setOptiError('Nem sikerült elérni az optimalizálást. Próbáld újra.')
    } finally {
      setIsOptimizing(false)
    }
  }

  function handleEntryKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleSavePanel()
  }

  if (sheetMaterials.length === 0) {
    return (
      <div>
        <PageHeader
          title="Opti"
          description="Válassz anyagot, majd add meg a méreteket egymás után."
          icon={isPartner ? ScanSearch : undefined}
        />
        <section className="max-w-xl rounded-md border border-dashed border-border bg-subtle p-4">
          <p className="text-body font-medium text-ink">
            Még nincs táblás anyag.
          </p>
          <p className="mt-1 text-body text-ink-secondary">
            {isPartner
              ? 'A kapcsolt cégnek nincs aktív táblás anyaga. Kérdezd meg a céget, vagy válassz másik céget.'
              : 'Adj hozzá egyet a törzsadatokban, majd frissítsd ezt az oldalt.'}
          </p>
          {!isPartner ? (
            <Link
              href="/torzsadatok/alapanyagok/tablas-anyagok"
              className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
            >
              Táblás anyagok
            </Link>
          ) : null}
        </section>
      </div>
    )
  }

  const entryEnabled = Boolean(selectedMaterial) && !changingMaterial

  return (
    <div className="space-y-3">
      <PageHeader
        title="Opti"
        description={headerDescription}
        icon={isPartner ? ScanSearch : undefined}
      />

      {editLoadError ? (
        <p
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
          role="alert"
        >
          {editLoadError}
          {initialEdit ? (
            <>
              {' '}
              <Link
                href={`/ajanlatok/${initialEdit.id}`}
                className="font-medium underline underline-offset-2"
              >
                Vissza az árajánlathoz
              </Link>
            </>
          ) : (
            <>
              {' '}
              <Link
                href="/ajanlatok"
                className="font-medium underline underline-offset-2"
              >
                Árajánlatok
              </Link>
            </>
          )}
        </p>
      ) : null}

      {isEditMode && initialEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2">
          <p className="text-body text-ink">
            Szerkesztés:{' '}
            <span className="font-semibold tabular-nums">
              {initialEdit.quote_number}
            </span>
            <span className="text-ink-secondary">
              {' '}
              — a nesting nincs visszatöltve, optimalizálj újra.
            </span>
          </p>
          <Link
            href={`/ajanlatok/${initialEdit.id}`}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
          >
            Vissza az árajánlathoz
          </Link>
        </div>
      ) : null}

      {isEditMode && initialEdit && initialEdit.warnings.length > 0 ? (
        <div
          className="space-y-1 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-body text-warning-ink"
          role="status"
        >
          {initialEdit.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Mobil: előnézet/anyag előbb */}
        <MaterialPreviewColumn
          className="order-1 lg:order-2 lg:sticky lg:top-14 lg:self-start"
          sheetMaterialId={sheetMaterialId}
          selectedMaterial={selectedMaterial}
          sheetsByManufacturer={sheetsByManufacturer}
          changing={changingMaterial}
          materialError={errors.material}
          grainMm={previewGrain}
          crossMm={previewCross}
          edgeAId={edgeAId}
          edgeBId={edgeBId}
          edgeCId={edgeCId}
          edgeDId={edgeDId}
          onChangeMaterialId={selectMaterial}
          onStartChange={() => setChangingMaterial(true)}
          onCancelChange={() => setChangingMaterial(false)}
        />

        <section
          className={
            entryEnabled
              ? 'order-2 rounded-md border border-border bg-surface p-3 lg:order-1'
              : 'order-2 rounded-md border border-dashed border-border bg-subtle p-3 opacity-70 lg:order-1'
          }
        >
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-h3 text-ink">
                {editingPanelId ? 'Panel szerkesztése' : 'Panel felvitele'}
              </h2>
              {editingPanelId ? (
                <p className="text-hint text-ink-secondary">
                  A kiválasztott sor adatai a formban. Mentés után új panelt
                  adhatsz hozzá.
                </p>
              ) : null}
            </div>
            {!entryEnabled ? (
              <p className="text-hint text-ink-secondary">
                Előbb válassz anyagot
                <span className="hidden lg:inline"> jobbra</span>
                <span className="lg:hidden"> felül</span>.
              </p>
            ) : null}
          </div>

          <fieldset
            disabled={!entryEnabled}
            className="min-w-0 space-y-2.5 disabled:pointer-events-none"
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="Szálirány"
                htmlFor="opti-grain"
                required
                error={errors.grain}
                hint={grainHint}
              >
                <div className="relative">
                  <Input
                    ref={grainInputRef}
                    id="opti-grain"
                    value={grainRaw}
                    onChange={(e) => {
                      setGrainRaw(clampDimensionRaw(e.target.value, maxGrain))
                      setErrors((prev) => ({ ...prev, grain: undefined }))
                    }}
                    onKeyDown={handleEntryKeyDown}
                    inputMode="numeric"
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                    mm
                  </span>
                </div>
              </FormField>

              <FormField
                label="Keresztirány"
                htmlFor="opti-cross"
                required
                error={errors.cross}
                hint={crossHint}
              >
                <div className="relative">
                  <Input
                    id="opti-cross"
                    value={crossRaw}
                    onChange={(e) => {
                      setCrossRaw(clampDimensionRaw(e.target.value, maxCross))
                      setErrors((prev) => ({ ...prev, cross: undefined }))
                    }}
                    onKeyDown={handleEntryKeyDown}
                    inputMode="numeric"
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                    mm
                  </span>
                </div>
              </FormField>

              <FormField
                label="Darab"
                htmlFor="opti-qty"
                required
                error={errors.quantity}
                hint={
                  !errors.quantity ? 'Egész szám, legalább 1' : undefined
                }
              >
                <Input
                  id="opti-qty"
                  value={quantityRaw}
                  onChange={(e) => {
                    setQuantityRaw(clampQuantityRaw(e.target.value))
                    setErrors((prev) => ({ ...prev, quantity: undefined }))
                  }}
                  onKeyDown={handleEntryKeyDown}
                  inputMode="numeric"
                />
              </FormField>

              <FormField
                label="Jelölés"
                htmlFor="opti-mark"
                optionalLabel
                error={errors.marking}
                hint={
                  !errors.marking
                    ? `${marking.length}/50`
                    : undefined
                }
              >
                <Input
                  id="opti-mark"
                  value={marking}
                  onChange={(e) => {
                    setMarking(e.target.value.slice(0, 50))
                    setErrors((prev) => ({ ...prev, marking: undefined }))
                  }}
                  onKeyDown={handleEntryKeyDown}
                  placeholder="pl. A1"
                  autoComplete="off"
                  maxLength={50}
                />
              </FormField>
            </div>

            <div className="border-t border-border pt-2.5">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <EdgeSelect
                  id="opti-edge-a"
                  label="Hosszú felső"
                  value={edgeAId}
                  options={edgeOptions}
                  disabled={edgeMaterials.length === 0}
                  onChange={(v) => setEdge('a', v)}
                />
                <EdgeSelect
                  id="opti-edge-c"
                  label="Hosszú alsó"
                  value={edgeCId}
                  options={edgeOptions}
                  disabled={edgeMaterials.length === 0}
                  onChange={(v) => setEdge('c', v)}
                />
                <EdgeSelect
                  id="opti-edge-d"
                  label="Széles bal"
                  value={edgeDId}
                  options={edgeOptions}
                  disabled={edgeMaterials.length === 0}
                  onChange={(v) => setEdge('d', v)}
                />
                <EdgeSelect
                  id="opti-edge-b"
                  label="Széles jobb"
                  value={edgeBId}
                  options={edgeOptions}
                  disabled={edgeMaterials.length === 0}
                  onChange={(v) => setEdge('b', v)}
                />
              </div>
            </div>

            <div className="border-t border-border pt-2.5">
              <FormField
                label="Élzárás körbe"
                htmlFor="opti-edge-around"
                optionalLabel
                className="max-w-sm"
              >
                <MenuSelect
                  id="opti-edge-around"
                  value={edgeAroundId}
                  options={edgeOptions}
                  placeholder="Nincs"
                  emptyLabel="Nincs"
                  disabled={edgeMaterials.length === 0}
                  onChange={handleAroundChange}
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2 pt-0.5">
              {editingPanelId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelEdit}
                >
                  Mégse
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={handleSavePanel}
                disabled={!entryEnabled}
              >
                {editingPanelId ? 'Panel mentése' : 'Panel hozzáadása'}
              </Button>
            </div>
          </fieldset>
        </section>
      </div>

      {panels.length > 0 ? (
        <>
          <PanelsTable
            panels={panels}
            editingPanelId={editingPanelId}
            onEdit={loadPanelForEdit}
            onDelete={(panel) => setDeleteTarget(panel)}
          />

          <div className="flex flex-col items-center gap-2">
            {optiError ? (
              <p
                className="max-w-lg rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-center text-body text-danger-ink"
                role="alert"
              >
                {optiError}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={handleOptimize}
              disabled={panels.length === 0}
              loading={isOptimizing}
              className="min-w-[10rem]"
            >
              {isOptimizing
                ? 'Optimalizálás…'
                : optiResult
                  ? 'Újraoptimalizálás'
                  : 'Optimalizálás'}
            </Button>
          </div>
        </>
      ) : null}

      {optiResult ? (
        <div ref={resultsRef} className="space-y-4 scroll-mt-4">
          <OptiResultsStrip
            result={optiResult}
            sheetMaterials={sheetMaterials}
          />
          {quoteResult ? <OptiQuoteStrip quote={quoteResult} /> : null}
          {quoteResult && isPartner && partnerCustomer ? (
            <PartnerOptiSaveStrip
              customer={partnerCustomer}
              companyLabel={companyLabel}
              panels={panels}
              quote={quoteResult}
              sheetMaterials={sheetMaterials}
              quoteId={editingQuoteId}
              initialProjectName={
                isEditMode ? initialEdit?.project_name ?? null : null
              }
              initialSessionProjectName={
                persistSession ? sessionProjectName : null
              }
              onSessionProjectNameChange={
                persistSession ? setSessionProjectName : undefined
              }
              onSaveSuccess={
                persistSession ? handleSessionClearedAfterSave : undefined
              }
            />
          ) : null}
          {quoteResult && !isPartner ? (
            <OptiCustomerStrip
              customers={customers}
              panels={panels}
              quote={quoteResult}
              sheetMaterials={sheetMaterials}
              quoteId={editingQuoteId}
              initialCustomer={isEditMode ? initialEdit?.customer ?? null : null}
              initialProjectName={
                isEditMode ? initialEdit?.project_name ?? null : null
              }
              initialDraft={persistSession ? sessionCustomer : null}
              initialSessionProjectName={
                persistSession ? sessionProjectName : null
              }
              onSessionCustomerChange={
                persistSession ? handleSessionCustomerChange : undefined
              }
              onSaveSuccess={
                persistSession ? handleSessionClearedAfterSave : undefined
              }
            />
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Panel törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd a(z) ${deleteTarget.grainMm} × ${deleteTarget.crossMm} mm panelt?`
            : ''
        }
        confirmLabel="Törlés"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function EdgeSelect({
  id,
  label,
  value,
  options,
  disabled,
  onChange
}: {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string; hint?: string }>
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <FormField label={label} htmlFor={id} optionalLabel>
      <MenuSelect
        id={id}
        value={value}
        options={options}
        placeholder="Nincs"
        emptyLabel="Nincs"
        disabled={disabled}
        onChange={onChange}
      />
    </FormField>
  )
}
