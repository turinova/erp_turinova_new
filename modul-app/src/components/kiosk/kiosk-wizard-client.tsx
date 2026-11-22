'use client'

import {
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  CircleDot,
  Clock,
  Layers,
  Minus,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Triangle,
  X
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties
} from 'react'
import { toast } from 'sonner'

import { KioskMachiningPreview } from '@/components/kiosk/kiosk-machining-preview'
import { KioskPriceExplainSheet } from '@/components/kiosk/kiosk-price-explain-sheet'
import { KioskAttract } from '@/components/kiosk/attract/kiosk-attract'
import { KioskShell } from '@/components/kiosk/kiosk-shell'
import { KioskDetailsStep } from '@/components/kiosk/details/kiosk-details-step'
import { KioskSuccessStep } from '@/components/kiosk/details/kiosk-success-step'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect, menuSearchMatch } from '@/components/ui/menu-select'
import type { KioskBootstrapPayload } from '@/lib/kiosk/bootstrap-types'
import {
  EDGE_COPY,
  EDGE_SLOT_UI,
  EDGE_STRAIGHT_UI
} from '@/lib/kiosk/edge-slots'
import {
  defaultEdgeTypeId,
  edgeTypesForDuplung
} from '@/lib/kiosk/edge-types'
import { EMPTY_KIOSK_GUEST, validateKioskGuest } from '@/lib/kiosk/guest'
import { formatHuf, formatSheetDims } from '@/lib/kiosk/mock-data'
import type { KioskPriceMaterialExplain } from '@/lib/kiosk/price'
import {
  defaultSzogCut,
  EMPTY_KIOSK_MACHINING,
  isMachiningReady,
  PANTHELY_QTY_CHIPS
} from '@/lib/kiosk/machining'
import {
  duplungStatusLabel,
  MACHINING_COPY,
  machiningSummaryChips
} from '@/lib/kiosk/machining-copy'
import { cutFromRemain, remainFromCut } from '@/lib/opti/szogvagas-preview'
import {
  edgeCartChips,
  edgeSummaryLabel,
  sanitizeEdgeIdsForDuplung
} from '@/lib/kiosk/mock-pricing'
import {
  clampDimensionRaw,
  formatCrossMaxHint,
  formatGrainMaxHint,
  kioskMaxCrossMm,
  kioskMaxGrainMm,
  validateKioskSize
} from '@/lib/kiosk/size-limits'
import type {
  EdgeSide,
  EdgeSlot,
  KioskCartLine,
  KioskGuest,
  KioskMachining,
  KioskStep,
  PanthelyOldal,
  SzogCornerId
} from '@/lib/kiosk/types'
import { KIOSK_LABEL_MAX } from '@/lib/kiosk/types'
import { FINISHED_SIZE_COPY, LEFTOVER_COPY } from '@/lib/kiosk/leftover'
import {
  consumeKioskPairingParam,
  readKioskDeviceToken
} from '@/lib/kiosk/pairing'
import { StatusBadge } from '@/components/patterns/status-badge'
import { cn } from '@/lib/utils'

type KioskSheet = KioskBootstrapPayload['sheets'][number]
type KioskEdge = KioskBootstrapPayload['edges'][number]

type PriceStatus = 'none' | 'stale' | 'loading' | 'ok' | 'error'

type DraftPanel = {
  sheetId: string
  grainRaw: string
  crossRaw: string
  quantity: number
  /** null = még nem döntött a megmunkálásról */
  machining: KioskMachining | null
  /** Duplung ON előtt tárolt db (Opti-szerű visszaállítás). */
  qtyBeforeDuplung: number | null
  edgeIds: Partial<Record<EdgeSlot, string>>
  /** „Körbe ezzel” alapértelmezett típus */
  selectedEdgeMaterialId: string
  editingLineId: string | null
  label: string
}

const EMPTY_DRAFT: DraftPanel = {
  sheetId: '',
  grainRaw: '',
  crossRaw: '',
  label: '',
  quantity: 1,
  machining: null,
  qtyBeforeDuplung: null,
  edgeIds: {},
  selectedEdgeMaterialId: defaultEdgeTypeId(false),
  editingLineId: null
}

/** Opti-style: vízszintes vonalak + „Szál →” — csak grain_direction esetén. */
function GrainOverlay() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute left-[5%] right-[5%] z-[1] h-0.5 rounded-sm bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
          style={{ top: `${(i + 1) * 11}%` }}
          aria-hidden
        />
      ))}
      <span className="pointer-events-none absolute bottom-2 left-1/2 z-[2] -translate-x-1/2 rounded bg-surface px-2 py-0.5 text-[12px] font-semibold tracking-wide text-ink shadow-sm">
        Szál →
      </span>
    </>
  )
}

/** Fix stage belsejébe: panel fit-contain (a keret soha nem változik). */
function fitPanelSize(
  grainMm: number | null,
  crossMm: number | null,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const g = grainMm != null && grainMm > 0 ? grainMm : 100
  const c = crossMm != null && crossMm > 0 ? crossMm : 100
  const aspect = g / c
  if (aspect >= 1) {
    const width = Math.min(maxW, maxH * aspect)
    return { width, height: width / aspect }
  }
  const height = Math.min(maxH, maxW / aspect)
  return { width: height * aspect, height }
}

/** 21″ kiosk: fix preview stage belseje (px). */
const SIZE_STAGE_INNER_W = 420
const SIZE_STAGE_INNER_H = 300

/** Panel / thumb kitöltés: anyagkép, ha nincs → swatch. */
function sheetFillStyle(
  sheet: Pick<KioskSheet, 'imageUrl' | 'swatch'>
): CSSProperties {
  if (sheet.imageUrl) {
    return {
      backgroundImage: `url(${sheet.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#e4e4e7'
    }
  }
  return { background: sheet.swatch }
}

const SIDES: Array<{ id: EdgeSide; label: string }> = EDGE_STRAIGHT_UI.map(
  (e) => ({ id: e.slot, label: e.label })
)

function newId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function newSubmissionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function parseMm(raw: string): number | null {
  const n = Number(String(raw).replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function KioskWizardClient({
  slug,
  bootstrap
}: {
  slug: string
  bootstrap: KioskBootstrapPayload
}) {
  const tenantLabel = bootstrap.tenant.name
  const tenantLogoUrl = bootstrap.tenant.logoUrl
  const catalogSheets = bootstrap.sheets
  const mappedEdges = bootstrap.edges
  const maxQty = bootstrap.settings.maxQtyPerLine
  const maxRows = bootstrap.settings.maxPanelRows

  const [step, setStep] = useState<KioskStep>('attract')

  useEffect(() => {
    if (consumeKioskPairingParam()) {
      toast.success('Ez a gép mostantól kiosk. Lehet rendelni rajta.')
    }
  }, [])

  const [materialQuery, setMaterialQuery] = useState('')
  const [draft, setDraft] = useState<DraftPanel>(EMPTY_DRAFT)
  const [cart, setCart] = useState<KioskCartLine[]>([])
  const [guest, setGuest] = useState<KioskGuest>(EMPTY_KIOSK_GUEST)
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [priceChange, setPriceChange] = useState<number | null>(null)
  const submittingRef = useRef(false)
  const submissionIdRef = useRef<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [priceStatus, setPriceStatus] = useState<PriceStatus>('none')
  const [pricedTotalGross, setPricedTotalGross] = useState<number | null>(null)
  const [pricedMaterials, setPricedMaterials] = useState<
    KioskPriceMaterialExplain[] | null
  >(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [pricePending, startPriceTransition] = useTransition()

  const sheet = catalogSheets.find((s) => s.id === draft.sheetId) ?? null
  const grainMm = parseMm(draft.grainRaw)
  const crossMm = parseMm(draft.crossRaw)
  const maxGrainMm = sheet ? kioskMaxGrainMm(sheet) : 0
  const maxCrossMm = sheet ? kioskMaxCrossMm(sheet) : 0

  function edgesForDuplung(duplung: boolean): KioskEdge[] {
    return mappedEdges.filter((e) => e.requiresDuplung === duplung)
  }

  function allowedTypeIds(duplung: boolean): string[] {
    const mapped = edgesForDuplung(duplung).map((e) => e.typeId)
    return mapped.length > 0
      ? mapped
      : edgeTypesForDuplung(duplung).map((t) => t.id)
  }

  function defaultMappedTypeId(duplung: boolean): string {
    return (
      edgesForDuplung(duplung)[0]?.typeId ?? defaultEdgeTypeId(duplung)
    )
  }

  /** Kosár változott → újra kell számolni (nincs auto-price). */
  function markPriceStale() {
    setPriceStatus((s) => (s === 'none' ? 'none' : 'stale'))
    setPricedTotalGross(null)
    setPricedMaterials(null)
    setPriceError(null)
    setCart((prev) =>
      prev.some((l) => l.lineGross !== 0)
        ? prev.map((l) => (l.lineGross !== 0 ? { ...l, lineGross: 0 } : l))
        : prev
    )
  }

  const sheets = useMemo(() => {
    const filtered = catalogSheets.filter((s) =>
      menuSearchMatch(
        `${s.name} ${s.manufacturerName} ${s.machineCode} ${s.thicknessMm}mm ${s.lengthMm} ${s.widthMm}`,
        materialQuery
      )
    )
    return filtered.sort((a, b) => {
      if (a.onStock !== b.onStock) return a.onStock ? -1 : 1
      return a.name.localeCompare(b.name, 'hu')
    })
  }, [catalogSheets, materialQuery])

  /** Üres keresés: quote-gyakoriság (bootstrap), max 8. */
  const featuredStock = bootstrap.featuredSheets

  const sizeValidation = useMemo(
    () =>
      validateKioskSize({
        sheet,
        grainRaw: draft.grainRaw,
        crossRaw: draft.crossRaw,
        grainMm,
        crossMm
      }),
    [sheet, draft.grainRaw, draft.crossRaw, grainMm, crossMm]
  )

  const sizeHardBlock = sizeValidation.hardBlock
  const softWarn = sizeValidation.softWarn
  const sizeHardErrors = sizeValidation.hardErrors

  function resetAll() {
    if (submittingRef.current) return
    submissionIdRef.current = null
    setPriceChange(null)
    setStep('attract')
    setDraft(EMPTY_DRAFT)
    setCart([])
    setGuest(EMPTY_KIOSK_GUEST)
    setOrderNumber(null)
    setSubmitting(false)
    setDeleteTarget(null)
    setMaterialQuery('')
    setPriceStatus('none')
    setPricedTotalGross(null)
    setPricedMaterials(null)
    setPriceError(null)
  }

  function selectSheet(s: KioskSheet) {
    setDraft({
      ...EMPTY_DRAFT,
      sheetId: s.id,
      selectedEdgeMaterialId: defaultMappedTypeId(false)
    })
    setMaterialQuery('')
    setStep('size')
  }

  /** Kosár: ugyanabból az anyagból még egy panel — Anyag lépés kihagyva. */
  function addSameSheet(sheetId: string) {
    const s = catalogSheets.find((x) => x.id === sheetId)
    if (!s) {
      setDraft(EMPTY_DRAFT)
      setStep('material')
      return
    }
    selectSheet(s)
  }

  function goMachining() {
    if (sizeHardBlock || !sheet || grainMm == null || crossMm == null) return
    setStep('machining')
  }

  function goEdge() {
    if (!isMachiningReady(draft.machining, grainMm, crossMm)) return
    setDraft((d) => {
      const machining = d.machining ?? { ...EMPTY_KIOSK_MACHINING }
      const duplung = Boolean(machining.duplungolas)
      let edgeIds = sanitizeEdgeIdsForDuplung(
        d.edgeIds,
        duplung,
        allowedTypeIds(duplung)
      )
      if (!machining.szog && edgeIds.ferde) {
        edgeIds = { ...edgeIds }
        delete edgeIds.ferde
      }
      const allowed = edgesForDuplung(duplung)
      return {
        ...d,
        machining,
        edgeIds,
        selectedEdgeMaterialId:
          d.selectedEdgeMaterialId &&
          allowed.some((t) => t.typeId === d.selectedEdgeMaterialId)
            ? d.selectedEdgeMaterialId
            : defaultMappedTypeId(duplung)
      }
    })
    setStep('edge')
  }

  function toggleDuplung() {
    setDraft((d) => {
      const base = d.machining ?? { ...EMPTY_KIOSK_MACHINING }
      if (base.duplungolas) {
        const qty =
          d.qtyBeforeDuplung != null
            ? d.qtyBeforeDuplung
            : Math.max(1, Math.floor(d.quantity / 2))
        return {
          ...d,
          machining: { ...base, duplungolas: false },
          quantity: qty,
          qtyBeforeDuplung: null,
          edgeIds: sanitizeEdgeIdsForDuplung(
            d.edgeIds,
            false,
            allowedTypeIds(false)
          ),
          selectedEdgeMaterialId: defaultMappedTypeId(false)
        }
      }
      return {
        ...d,
        machining: { ...base, duplungolas: true },
        qtyBeforeDuplung: d.quantity,
        quantity: Math.min(maxQty, d.quantity * 2),
        edgeIds: sanitizeEdgeIdsForDuplung(
          d.edgeIds,
          true,
          allowedTypeIds(true)
        ),
        selectedEdgeMaterialId: defaultMappedTypeId(true)
      }
    })
  }

  function togglePanthely() {
    setDraft((d) => {
      const base = d.machining ?? { ...EMPTY_KIOSK_MACHINING }
      if (base.panthely) {
        return { ...d, machining: { ...base, panthely: null } }
      }
      return {
        ...d,
        machining: {
          ...base,
          panthely: { quantity: 3, oldal: 'hosszu' }
        }
      }
    })
  }

  function setPanthelyQty(quantity: number) {
    setDraft((d) => {
      if (!d.machining?.panthely) return d
      return {
        ...d,
        machining: {
          ...d.machining,
          panthely: { ...d.machining.panthely, quantity }
        }
      }
    })
  }

  function setPanthelyOldal(oldal: PanthelyOldal) {
    setDraft((d) => {
      if (!d.machining?.panthely) return d
      return {
        ...d,
        machining: {
          ...d.machining,
          panthely: { ...d.machining.panthely, oldal }
        }
      }
    })
  }

  function toggleSzog() {
    setDraft((d) => {
      const base = d.machining ?? { ...EMPTY_KIOSK_MACHINING }
      if (base.szog) {
        const nextEdges = { ...d.edgeIds }
        delete nextEdges.ferde
        return {
          ...d,
          machining: { ...base, szog: null },
          edgeIds: nextEdges
        }
      }
      if (grainMm == null || crossMm == null) return d
      return {
        ...d,
        machining: { ...base, szog: defaultSzogCut(grainMm, crossMm) }
      }
    })
  }

  function setSzogCorner(corner: SzogCornerId) {
    setDraft((d) => {
      if (!d.machining?.szog) return d
      return {
        ...d,
        machining: {
          ...d.machining,
          szog: { ...d.machining.szog, corner }
        }
      }
    })
  }

  function setSzogAlong(patch: { alongGrainMm?: number; alongCrossMm?: number }) {
    setDraft((d) => {
      if (!d.machining?.szog) return d
      return {
        ...d,
        machining: {
          ...d.machining,
          szog: { ...d.machining.szog, ...patch }
        }
      }
    })
  }

  function setEdgeSlot(slot: EdgeSlot, edgeTypeId: string | null) {
    setDraft((d) => {
      const next = { ...d.edgeIds }
      if (!edgeTypeId) delete next[slot]
      else next[slot] = edgeTypeId
      return {
        ...d,
        edgeIds: next,
        selectedEdgeMaterialId: edgeTypeId ?? d.selectedEdgeMaterialId
      }
    })
  }

  function commitLine(edgeIds: Partial<Record<EdgeSlot, string>>) {
    if (
      !sheet ||
      grainMm == null ||
      crossMm == null ||
      !isMachiningReady(draft.machining, grainMm, crossMm)
    ) {
      return
    }
    if (!draft.editingLineId && cart.length >= maxRows) {
      toast.error(`Max. ${maxRows} tétel lehet a kosárban.`)
      return
    }
    const machining = draft.machining ?? { ...EMPTY_KIOSK_MACHINING }
    const line: KioskCartLine = {
      id: draft.editingLineId ?? newId(),
      sheetId: sheet.id,
      grainMm,
      crossMm,
      quantity: draft.quantity,
      machining,
      edgeIds,
      label: draft.label.trim().slice(0, KIOSK_LABEL_MAX),
      lineGross: 0
    }
    setCart((prev) => {
      if (draft.editingLineId) {
        return prev.map((p) => (p.id === draft.editingLineId ? line : p))
      }
      return [...prev, line]
    })
    setDraft(EMPTY_DRAFT)
    markPriceStale()
    setStep('cart')
  }

  function addToCart() {
    commitLine({ ...draft.edgeIds })
  }

  /** Él lépés: él kihagyása → kosár (megmunkálás már megvan). */
  function addWithoutEdge() {
    if (
      sizeHardBlock ||
      !isMachiningReady(draft.machining, grainMm, crossMm)
    ) {
      return
    }
    commitLine({})
  }

  function editLine(line: KioskCartLine) {
    const duplung = line.machining.duplungolas
    const anyEdge =
      SIDES.map((s) => line.edgeIds[s.id]).find(Boolean) ??
      line.edgeIds.ferde ??
      ''
    setDraft({
      sheetId: line.sheetId,
      grainRaw: String(line.grainMm),
      crossRaw: String(line.crossMm),
      label: line.label ?? '',
      quantity: line.quantity,
      machining: line.machining,
      qtyBeforeDuplung: duplung
        ? Math.max(1, Math.floor(line.quantity / 2))
        : null,
      edgeIds: sanitizeEdgeIdsForDuplung(
        line.edgeIds,
        duplung,
        allowedTypeIds(duplung)
      ),
      selectedEdgeMaterialId: anyEdge || defaultMappedTypeId(duplung),
      editingLineId: line.id
    })
    markPriceStale()
    setStep('size')
  }

  /** Opti-szerű manuális árszámítás — csak kosár tételek. */
  function runPrice() {
    if (cart.length === 0) return
    setPriceStatus('loading')
    setPriceError(null)
    startPriceTransition(async () => {
      try {
        const token = readKioskDeviceToken()
        const res = await fetch(
          `/api/kiosk/${encodeURIComponent(slug)}/price`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              lines: cart.map((l) => ({
                id: l.id,
                sheetId: l.sheetId,
                grainMm: l.grainMm,
                crossMm: l.crossMm,
                quantity: l.quantity,
                machining: l.machining,
                edgeIds: l.edgeIds,
                label: l.label
              }))
            })
          }
        )
        const data = (await res.json()) as {
          error?: string
          totalGross?: number
          lines?: Array<{ id: string; gross: number }>
          materials?: KioskPriceMaterialExplain[]
        }
        if (!res.ok) {
          setPriceStatus('error')
          setPricedTotalGross(null)
          setPricedMaterials(null)
          setPriceError(data.error ?? 'Nem sikerült az árat kiszámolni.')
          toast.error(data.error ?? 'Nem sikerült az árat kiszámolni.')
          return
        }
        const total = Math.round(Number(data.totalGross) || 0)
        setPricedTotalGross(total)
        setPricedMaterials(
          Array.isArray(data.materials) ? data.materials : null
        )
        if (data.lines?.length) {
          const grossById = new Map(data.lines.map((l) => [l.id, l.gross]))
          setCart((prev) =>
            prev.map((l) => {
              const g = grossById.get(l.id)
              return g != null ? { ...l, lineGross: g } : l
            })
          )
        }
        setPriceStatus('ok')
        setPriceError(null)
      } catch {
        setPriceStatus('error')
        setPricedTotalGross(null)
        setPricedMaterials(null)
        setPriceError('Hálózati hiba az árszámításnál.')
        toast.error('Hálózati hiba az árszámításnál.')
      }
    })
  }

  async function submitOrder(expectedTotalGross: number) {
    if (submittingRef.current) return
    if (!validateKioskGuest(guest).ok) return

    const submissionId = submissionIdRef.current ?? newSubmissionId()
    submissionIdRef.current = submissionId
    submittingRef.current = true
    setSubmitting(true)
    setPriceChange(null)

    try {
      const token = readKioskDeviceToken()
      const res = await fetch(
        `/api/kiosk/${encodeURIComponent(slug)}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            submissionId,
            expectedTotalGross,
            guest,
            lines: cart.map((l) => ({
              id: l.id,
              sheetId: l.sheetId,
              grainMm: l.grainMm,
              crossMm: l.crossMm,
              quantity: l.quantity,
              machining: l.machining,
              edgeIds: l.edgeIds,
              label: l.label
            }))
          })
        }
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        code?: string
        totalGross?: number
        quoteNumber?: string
      }

      if (res.ok && data.ok) {
        setOrderNumber(data.quoteNumber ?? 'ok')
        setStep('success')
        return
      }

      if (data.code === 'price_changed' && data.totalGross != null) {
        setPriceChange(Math.round(data.totalGross))
        return
      }

      if (data.code === 'unplaced' || data.code === 'validation') {
        const msg = data.error ?? 'Valami nem stimmel a kosárban.'
        markPriceStale()
        setPriceStatus('error')
        setPriceError(msg)
        toast.error(msg)
        setStep('cart')
        return
      }

      toast.error(
        data.error ?? 'Nem sikerült leadni a rendelést. Próbáld újra, vagy szólj a pultnál.'
      )
    } catch {
      toast.error(
        'Nincs kapcsolat a szerverrel. Próbáld újra, vagy szólj a pultnál.'
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function startSubmit() {
    if (priceStatus !== 'ok' || pricedTotalGross == null) {
      toast.error('Előbb számold ki az árat a kosárban.')
      setStep('cart')
      return
    }
    void submitOrder(pricedTotalGross)
  }

  function acceptPriceChange() {
    if (priceChange == null) return
    const next = priceChange
    setPricedTotalGross(next)
    void submitOrder(next)
  }

  function primaryForStep(): {
    label?: string
    disabled?: boolean
    hint?: string
    onClick?: () => void
  } {
    switch (step) {
      case 'size':
        return {
          label: 'Tovább →',
          disabled: sizeHardBlock,
          onClick: () => goMachining()
        }
      case 'machining': {
        const ready = isMachiningReady(draft.machining, grainMm, crossMm)
        return {
          label: 'Élzárás megadása →',
          disabled: !ready,
          hint: !ready
            ? 'Egészítsd ki a pánthely / szög adatokat.'
            : undefined,
          onClick: () => goEdge()
        }
      }
      case 'edge':
        return {
          label: 'Kosárba →',
          disabled:
            sizeHardBlock ||
            !isMachiningReady(draft.machining, grainMm, crossMm),
          onClick: addToCart
        }
      case 'cart': {
        if (cart.length === 0) {
          return {
            label: 'Árszámítás optimalizálással',
            disabled: true,
            hint: 'A kosár üres.'
          }
        }
        if (priceStatus === 'loading' || pricePending) {
          return {
            label: 'Árszámítás optimalizálással',
            disabled: true
          }
        }
        if (priceStatus !== 'ok' || pricedTotalGross == null) {
          return {
            label: 'Árszámítás optimalizálással',
            disabled: false,
            hint:
              priceError ??
              (priceStatus === 'stale'
                ? 'A kosár változott. Számold újra az árat.'
                : undefined),
            onClick: runPrice
          }
        }
        return {
          label: 'Tovább a rendeléshez →',
          disabled: false,
          onClick: () => setStep('details')
        }
      }
      case 'details': {
        const v = validateKioskGuest(guest)
        return {
          label: 'Leadom a pultnak',
          disabled: !v.ok || submitting,
          hint: v.ok ? undefined : (v.missing ?? undefined),
          onClick: startSubmit
        }
      }
      default:
        return {}
    }
  }

  function backForStep() {
    switch (step) {
      case 'material':
        setStep('attract')
        break
      case 'size':
        if (draft.editingLineId) {
          setDraft(EMPTY_DRAFT)
          setStep('cart')
        } else {
          setStep('material')
        }
        break
      case 'machining':
        setStep('size')
        break
      case 'edge':
        setStep('machining')
        break
      case 'cart':
        setStep('material')
        break
      case 'details':
        setStep('cart')
        break
      default:
        break
    }
  }

  const primary = primaryForStep()
  const bare = step === 'attract' || step === 'success'

  return (
    <KioskShell
      tenantLabel={tenantLabel}
      tenantLogoUrl={tenantLogoUrl}
      step={step}
      totalGross={priceStatus === 'ok' ? pricedTotalGross : null}
      priceLoading={priceStatus === 'loading' || pricePending}
      cartPanelCount={cart.length}
      bare={bare}
      onIdleReset={resetAll}
      idleWarnSec={bootstrap.settings.idleWarnSec}
      idleResetSec={bootstrap.settings.idleResetSec}
      onOpenCart={() => setStep('cart')}
      onBack={
        step === 'material' ||
        step === 'size' ||
        step === 'machining' ||
        step === 'edge' ||
        step === 'cart' ||
        step === 'details'
          ? backForStep
          : undefined
      }
      primaryLabel={primary.label}
      primaryDisabled={primary.disabled}
      primaryHint={primary.hint}
      onPrimary={primary.onClick}
      primaryLoading={
        submitting ||
        (step === 'cart' && (priceStatus === 'loading' || pricePending))
      }
      secondaryActionLabel={
        step === 'edge' ? 'Él nélkül a kosárba' : undefined
      }
      secondaryActionDisabled={
        step === 'edge'
          ? sizeHardBlock ||
            !isMachiningReady(draft.machining, grainMm, crossMm)
          : undefined
      }
      onSecondaryAction={step === 'edge' ? addWithoutEdge : undefined}
    >
      {step === 'attract' ? (
        <KioskAttract
          tenantLabel={tenantLabel}
          tenantLogoUrl={tenantLogoUrl}
          featuredSheets={featuredStock}
          onStart={() => setStep('material')}
          onStartWithSheet={selectSheet}
        />
      ) : null}

      {step === 'material' ? (
        <MaterialStep
          sheets={sheets}
          featuredStock={featuredStock}
          totalCount={catalogSheets.length}
          query={materialQuery}
          onQuery={setMaterialQuery}
          onSelect={selectSheet}
        />
      ) : null}

      {step === 'size' && sheet ? (
        <SizeStep
          sheet={sheet}
          draft={draft}
          softWarn={softWarn}
          hardErrors={sizeHardErrors}
          needsBothDims={grainMm == null || crossMm == null}
          maxGrainMm={maxGrainMm}
          maxCrossMm={maxCrossMm}
          maxQty={maxQty}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onChangeSheet={() => {
            setDraft(EMPTY_DRAFT)
            setStep('material')
          }}
        />
      ) : null}

      {step === 'machining' && sheet ? (
        <MachiningStep
          sheet={sheet}
          grainMm={grainMm}
          crossMm={crossMm}
          quantity={draft.quantity}
          machining={draft.machining}
          onToggleDuplung={toggleDuplung}
          onTogglePanthely={togglePanthely}
          onPanthelyQty={setPanthelyQty}
          onPanthelyOldal={setPanthelyOldal}
          onToggleSzog={toggleSzog}
          onSzogCorner={setSzogCorner}
          onSzogAlong={setSzogAlong}
        />
      ) : null}

      {step === 'edge' && sheet && grainMm && crossMm ? (
        <EdgeStep
          sheet={sheet}
          grainMm={grainMm}
          crossMm={crossMm}
          draft={draft}
          edges={edgesForDuplung(Boolean(draft.machining?.duplungolas))}
          onSetSlot={setEdgeSlot}
        />
      ) : null}

      {step === 'cart' ? (
        <CartStep
          cart={cart}
          sheets={catalogSheets}
          priceStatus={priceStatus}
          priceError={priceError}
          pricedMaterials={pricedMaterials}
          onEdit={editLine}
          onAskDelete={setDeleteTarget}
          onAddSame={addSameSheet}
          onAddMore={() => {
            setDraft(EMPTY_DRAFT)
            setStep('material')
          }}
          onRunPrice={runPrice}
        />
      ) : null}

      {step === 'details' ? (
        <KioskDetailsStep
          guest={guest}
          cart={cart}
          sheets={catalogSheets}
          totalGross={pricedTotalGross ?? 0}
          onChange={setGuest}
          onEditCart={() => setStep('cart')}
        />
      ) : null}

      {step === 'success' && orderNumber ? (
        <KioskSuccessStep
          tenantLabel={tenantLabel}
          tenantLogoUrl={tenantLogoUrl}
          guestName={guest.name}
          hasLeftover={Boolean(
            pricedMaterials?.some((m) => m.fullBoardCount > 0)
          )}
          onAgain={resetAll}
        />
      ) : null}

      {priceChange != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-price-change-title"
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-elev3"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPriceChange(null)
            }}
          >
            <p
              id="kiosk-price-change-title"
              className="text-[20px] font-semibold text-ink"
            >
              Az ár közben változott
            </p>
            <p className="mt-2 text-[16px] text-ink-muted">
              Az új végösszeg bruttó{' '}
              <span className="font-semibold tabular-nums text-ink">
                {formatHuf(priceChange)}
              </span>
              {pricedTotalGross != null ? (
                <>
                  {' '}(eddig{' '}
                  <span className="tabular-nums">
                    {formatHuf(pricedTotalGross)}
                  </span>
                  )
                </>
              ) : null}
              . Ha így is jó, add le a rendelést.
            </p>
            <div className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-12 flex-1 text-[15px]"
                disabled={submitting}
                onClick={() => setPriceChange(null)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                className="h-12 flex-1 text-[15px]"
                autoFocus
                disabled={submitting}
                onClick={acceptPriceChange}
              >
                {submitting ? 'Leadás…' : 'Leadom ezen az áron'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-elev3">
            <p className="text-[18px] font-semibold text-ink">
              Törlöd ezt a darabot?
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-12 flex-1 text-[15px]"
                autoFocus
                onClick={() => setDeleteTarget(null)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                variant="danger"
                className="h-12 flex-1 text-[15px]"
                onClick={() => {
                  setCart((c) => c.filter((l) => l.id !== deleteTarget))
                  markPriceStale()
                  setDeleteTarget(null)
                }}
              >
                Törlés
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <p
        className={cn(
          'pointer-events-none fixed left-3 z-20 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-ink-muted',
          bare ? 'bottom-3' : 'bottom-[92px] md:bottom-3'
        )}
      >
        UX mock, nincs mentés
      </p>
    </KioskShell>
  )
}

function MaterialStep({
  sheets,
  featuredStock,
  totalCount,
  query,
  onQuery,
  onSelect
}: {
  sheets: KioskSheet[]
  featuredStock: KioskSheet[]
  totalCount: number
  query: string
  onQuery: (q: string) => void
  onSelect: (s: KioskSheet) => void
}) {
  const hasQuery = query.trim().length > 0
  const list = hasQuery ? sheets : featuredStock

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-[28px] font-semibold text-ink md:text-[32px]">
          Válaszd ki a lapot
        </h1>
        <p className="text-[14px] text-ink-muted tabular-nums">
          {hasQuery
            ? `${sheets.length} találat`
            : `${totalCount} lap a katalógusban`}
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-surface px-4 py-3 shadow-sm md:-mx-6 md:px-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Mit keresel? pl. tölgy, Egger, H1145"
            autoComplete="off"
            autoFocus
            enterKeyHint="search"
            className="h-14 border-border bg-surface pl-11 pr-12 text-[17px] shadow-sm"
            aria-label="Lap keresése"
          />
          {hasQuery ? (
            <Button
              type="button"
              variant="ghost"
              className="absolute right-1.5 top-1/2 size-11 -translate-y-1/2 p-0"
              aria-label="Keresés törlése"
              onClick={() => onQuery('')}
            >
              <X className="size-5" aria-hidden />
            </Button>
          ) : null}
        </div>
        {!hasQuery ? (
          <p className="mt-2 text-[14px] text-ink-secondary">
            Írd be a dekór nevét vagy kódját, vagy válassz lent a népszerű
            lapok közül.
          </p>
        ) : null}
      </div>

      {!hasQuery ? (
        <div>
          <h2 className="text-[17px] font-semibold text-ink">
            Ezeket viszik a legtöbben
          </h2>
          <p className="text-[13px] text-ink-muted">
            A „Rendelésre” lapot be kell szereznünk, ezért több idő, mire
            elkészül.
          </p>
        </div>
      ) : null}

      {hasQuery && sheets.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-[16px] text-ink">
            Nincs ilyen dekór. Próbáld a kódot, vagy kérdezd a pultot.
          </p>
          {featuredStock.length > 0 ? (
            <>
              <p className="text-[14px] text-ink-secondary">
                Vagy ezek közül:
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {featuredStock.slice(0, 4).map((s) => (
                  <SheetTile
                    key={s.id}
                    sheet={s}
                    query=""
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="h-11 text-[15px]"
            onClick={() => onQuery('')}
          >
            Keresés törlése
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-[16px] text-warning-ink">
          Most nincs választható lap. Gyere a pulthoz.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {list.map((s) => (
            <SheetTile
              key={s.id}
              sheet={s}
              query={hasQuery ? query : ''}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SheetTile({
  sheet: s,
  query,
  onSelect
}: {
  sheet: KioskSheet
  query: string
  onSelect: (s: KioskSheet) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(s)}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition active:scale-[0.98] hover:border-ink/30"
    >
      <div className="relative aspect-[4/3] w-full">
        <div
          className="absolute inset-0"
          style={
            s.imageUrl
              ? {
                  backgroundImage: `url(${s.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }
              : { background: s.swatch }
          }
          aria-hidden
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <StatusBadge
            tone={s.onStock ? 'success' : 'neutral'}
            variant={s.onStock ? 'soft' : 'outline'}
          >
            {s.onStock ? 'Raktáron' : 'Rendelésre'}
          </StatusBadge>
        </div>
        <div className="absolute bottom-2 right-2">
          <span className="rounded-md border border-border bg-white px-2 py-1 text-[13px] font-semibold tabular-nums text-ink shadow-sm">
            {s.thicknessMm} mm
          </span>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p className="text-[16px] font-semibold leading-snug text-ink">
          {highlightMatch(s.name, query)}
        </p>
        <p className="text-[13px] font-medium tabular-nums text-ink">
          {formatSheetDims(s)}
        </p>
        <p className="truncate text-[13px] text-ink-secondary">
          {highlightMatch(s.manufacturerName, query)}
          <span className="text-ink-muted">, </span>
          <span className="tabular-nums">
            {formatHuf(s.pricePerSqmGross)}/m²
          </span>
        </p>
        {s.machineCode ? (
          <p className="truncate font-mono text-[12px] text-ink-muted">
            {highlightMatch(s.machineCode, query)}
          </p>
        ) : null}
      </div>
    </button>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const lower = text.toLocaleLowerCase('hu')
  const tokens = q
    .toLocaleLowerCase('hu')
    .split(/\s+/)
    .filter((t) => t.length > 0)
  let earliest = -1
  let matched = ''
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i >= 0 && (earliest < 0 || i < earliest)) {
      earliest = i
      matched = text.slice(i, i + t.length)
    }
  }
  if (earliest < 0 || !matched) return text
  return (
    <>
      {text.slice(0, earliest)}
      <mark className="rounded-sm bg-warning-soft px-0.5 text-ink">
        {text.slice(earliest, earliest + matched.length)}
      </mark>
      {text.slice(earliest + matched.length)}
    </>
  )
}

function SizeStep({
  sheet,
  draft,
  softWarn,
  hardErrors,
  needsBothDims,
  maxGrainMm,
  maxCrossMm,
  maxQty,
  onChange,
  onChangeSheet
}: {
  sheet: KioskSheet
  draft: DraftPanel
  softWarn?: string | null
  hardErrors: string[]
  needsBothDims: boolean
  maxGrainMm: number
  maxCrossMm: number
  maxQty: number
  onChange: (p: Partial<DraftPanel>) => void
  onChangeSheet: () => void
}) {
  const grain = parseMm(draft.grainRaw)
  const cross = parseMm(draft.crossRaw)
  const [focusDim, setFocusDim] = useState<'grain' | 'cross' | null>(null)
  const grainHint = formatGrainMaxHint(sheet)
  const crossHint = formatCrossMaxHint(sheet)

  const panelSize = useMemo(
    () => fitPanelSize(grain, cross, SIZE_STAGE_INNER_W, SIZE_STAGE_INNER_H),
    [grain, cross]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="shrink-0 text-[24px] font-semibold text-ink md:text-[28px]">
          Mekkora legyen a lap?
        </h1>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5">
          <span
            className="size-9 shrink-0 rounded-md border border-border"
            style={sheetFillStyle(sheet)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-ink">
              {sheet.name}, {sheet.thicknessMm} mm
            </p>
            <p className="truncate text-[12px] tabular-nums text-ink-secondary">
              {formatSheetDims(sheet)}
            </p>
          </div>
          <StatusBadge
            tone={sheet.onStock ? 'success' : 'neutral'}
            variant={sheet.onStock ? 'soft' : 'outline'}
          >
            {sheet.onStock ? 'Raktáron' : 'Rendelésre'}
          </StatusBadge>
          <Button
            type="button"
            variant="secondary"
            className="h-10 text-[14px]"
            onClick={onChangeSheet}
          >
            Csere
          </Button>
        </div>
      </div>

      <p
        className="rounded-xl border border-border bg-subtle px-4 py-2.5 text-[15px] leading-snug text-ink"
        role="note"
      >
        {FINISHED_SIZE_COPY.sizeStep}
      </p>

      {/* Bal preview · Jobb adatok — LTR, items-start, 21″ */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-6">
        {/* BAL — FIX stage, belső panel skálázódik */}
        <div className="rounded-2xl border-2 border-ink/20 bg-surface p-3 md:p-4">
          <div
            className={cn(
              'mb-2 flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-[14px] font-semibold tabular-nums transition',
              focusDim === 'grain' ? 'bg-ink text-white' : 'bg-subtle text-ink'
            )}
          >
            <ArrowLeftRight className="size-4 shrink-0 opacity-80" aria-hidden />
            Szálirány{' '}
            <span>{grain != null ? `${grain} mm` : '- mm'}</span>
          </div>

          <div className="flex gap-2">
            <div
              className={cn(
                'flex h-[360px] w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-lg text-center text-[12px] font-semibold leading-tight transition',
                focusDim === 'cross' ? 'bg-ink text-white' : 'bg-subtle text-ink'
              )}
            >
              <ArrowUpDown className="size-3.5 opacity-80" aria-hidden />
              <span className="[writing-mode:vertical-rl] rotate-180">
                Kereszt
              </span>
              <span className="tabular-nums text-[11px]">
                {cross != null ? cross : '-'}
              </span>
            </div>

            {/* Fix stage — soha nem változik a mérete */}
            <div className="flex h-[360px] min-w-0 flex-1 items-center justify-center rounded-xl bg-subtle">
              <div
                className={cn(
                  'relative flex items-center justify-center overflow-hidden border-[3px] transition',
                  focusDim ? 'border-ink' : 'border-ink/50'
                )}
                style={{
                  width: panelSize.width,
                  height: panelSize.height,
                  ...sheetFillStyle(sheet)
                }}
              >
                {sheet.grainDirection ? <GrainOverlay /> : null}
                <span className="relative z-[3] rounded-md bg-white px-2.5 py-1 text-[15px] font-semibold tabular-nums text-ink shadow-sm">
                  {grain && cross ? `${grain} × ${cross} mm` : '- × - mm'}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-2 h-5 text-center text-[13px] text-ink-secondary">
            {sheet.grainDirection
              ? 'A vonalak a szálat mutatják (vízszintes).'
              : 'Nincs szál. A két méret a két oldal.'}
          </p>
        </div>

        {/* JOBB — top-aligned form */}
        <div className="flex flex-col justify-start gap-3 pt-0">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <ArrowLeftRight className="size-3.5" aria-hidden />
              Szálirány
              <span className="font-normal text-ink-muted">(szál mentén)</span>
            </span>
            <div className="relative">
              <Input
                inputMode="numeric"
                value={draft.grainRaw}
                placeholder="pl. 800"
                className={cn(
                  'h-14 pr-11 text-[22px] font-semibold tabular-nums',
                  focusDim === 'grain' && 'border-ink ring-2 ring-ink/20'
                )}
                onFocus={() => setFocusDim('grain')}
                onBlur={() => setFocusDim((d) => (d === 'grain' ? null : d))}
                onChange={(e) =>
                  onChange({
                    grainRaw: clampDimensionRaw(e.target.value, maxGrainMm)
                  })
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-muted">
                mm
              </span>
            </div>
            <p className="mt-1 text-[13px] tabular-nums text-ink-muted">
              {grainHint}
            </p>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <ArrowUpDown className="size-3.5" aria-hidden />
              Keresztirány
              <span className="font-normal text-ink-muted">(merőlegesen)</span>
            </span>
            <div className="relative">
              <Input
                inputMode="numeric"
                value={draft.crossRaw}
                placeholder="pl. 400"
                className={cn(
                  'h-14 pr-11 text-[22px] font-semibold tabular-nums',
                  focusDim === 'cross' && 'border-ink ring-2 ring-ink/20'
                )}
                onFocus={() => setFocusDim('cross')}
                onBlur={() => setFocusDim((d) => (d === 'cross' ? null : d))}
                onChange={(e) =>
                  onChange({
                    crossRaw: clampDimensionRaw(e.target.value, maxCrossMm)
                  })
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-muted">
                mm
              </span>
            </div>
            <p className="mt-1 text-[13px] tabular-nums text-ink-muted">
              {crossHint}
            </p>
          </label>

          <div className="flex items-center gap-3">
            <span className="text-[14px] font-medium text-ink-secondary">Db</span>
            <Button
              type="button"
              variant="secondary"
              className="size-11 p-0"
              aria-label="Kevesebb"
              onClick={() =>
                onChange({ quantity: Math.max(1, draft.quantity - 1) })
              }
            >
              <Minus className="size-4" />
            </Button>
            <span className="min-w-[2rem] text-center text-[20px] font-semibold tabular-nums">
              {draft.quantity}
            </span>
            <Button
              type="button"
              variant="secondary"
              className="size-11 p-0"
              aria-label="Több"
              onClick={() =>
                onChange({
                  quantity: Math.min(maxQty, draft.quantity + 1)
                })
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              Megnevezés
              <span className="font-normal text-ink-muted">(nem kötelező)</span>
            </span>
            <Input
              value={draft.label}
              maxLength={KIOSK_LABEL_MAX}
              autoComplete="off"
              className="h-12 text-[17px]"
              onChange={(e) => onChange({ label: e.target.value })}
            />
            <p className="mt-1 text-[13px] text-ink-muted">
              Például: Konyha ajtó. Így a kosárban és a pultnál is könnyen
              felismered.
            </p>
          </label>

          {/* Üzenetek a mezőknél — nagy tipó, távolról olvasható; NEM a footerben */}
          {needsBothDims && hardErrors.length === 0 ? (
            <p
              className="rounded-xl border-2 border-ink/25 bg-subtle px-4 py-3 text-[18px] font-semibold leading-snug text-ink"
              role="status"
            >
              Írd be mindkét méretet milliméterben (mm).
            </p>
          ) : null}
          {hardErrors.map((e) => (
            <p
              key={e}
              className="rounded-xl border-2 border-danger/50 bg-danger-soft px-4 py-3 text-[18px] font-semibold leading-snug text-danger-ink"
              role="alert"
            >
              {e}
            </p>
          ))}
          {softWarn ? (
            <p
              className="rounded-xl border-2 border-warning/50 bg-warning-soft px-4 py-3 text-[18px] font-semibold leading-snug text-warning-ink"
              role="status"
            >
              {softWarn}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MachiningStep({
  sheet,
  grainMm,
  crossMm,
  quantity,
  machining,
  onToggleDuplung,
  onTogglePanthely,
  onPanthelyQty,
  onPanthelyOldal,
  onToggleSzog,
  onSzogCorner,
  onSzogAlong
}: {
  sheet: KioskSheet
  grainMm: number | null
  crossMm: number | null
  quantity: number
  machining: KioskMachining | null
  onToggleDuplung: () => void
  onTogglePanthely: () => void
  onPanthelyQty: (n: number) => void
  onPanthelyOldal: (o: PanthelyOldal) => void
  onToggleSzog: () => void
  onSzogCorner: (c: SzogCornerId) => void
  onSzogAlong: (p: { alongGrainMm?: number; alongCrossMm?: number }) => void
}) {
  const duplungOn = Boolean(machining?.duplungolas)
  const panthelyOn = Boolean(machining?.panthely)
  const szogOn = Boolean(machining?.szog)
  const canPreview = grainMm != null && crossMm != null && grainMm > 0 && crossMm > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold text-ink md:text-[28px]">
            {MACHINING_COPY.h1}
          </h1>
          <p className="text-[15px] text-ink-secondary">{MACHINING_COPY.sub}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5">
          <span
            className="size-9 shrink-0 rounded-md border border-border"
            style={sheetFillStyle(sheet)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-ink">
              {sheet.name}, {sheet.thicknessMm} mm
            </p>
            <p className="truncate text-[12px] tabular-nums text-ink-secondary">
              {canPreview
                ? `${grainMm} × ${crossMm} mm, ${quantity} db`
                : '- × - mm'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-6">
        {/* BAL — Opti-szerű preview */}
        {canPreview ? (
          <KioskMachiningPreview
            grainMm={grainMm}
            crossMm={crossMm}
            swatch={sheet.swatch}
            imageUrl={sheet.imageUrl}
            grainDirection={sheet.grainDirection}
            quantity={quantity}
            machining={machining}
            onSelectSzogCorner={szogOn ? onSzogCorner : undefined}
          />
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-subtle text-[16px] text-ink-muted">
            Előbb add meg a méretet
          </div>
        )}

        {/* JOBB — választók; default = nincs megmunkálás, tovább aktív */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <MachiningToggleTile
              title={MACHINING_COPY.duplungTitle}
              hint={MACHINING_COPY.duplungHint}
              Icon={Layers}
              active={duplungOn}
              onClick={onToggleDuplung}
              compact
            />
            <MachiningToggleTile
              title={MACHINING_COPY.panthelyTitle}
              hint={MACHINING_COPY.panthelyHint}
              Icon={CircleDot}
              active={panthelyOn}
              onClick={onTogglePanthely}
              compact
            />
            <MachiningToggleTile
              title={MACHINING_COPY.szogTitle}
              hint={MACHINING_COPY.szogHint}
              Icon={Triangle}
              active={szogOn}
              onClick={onToggleSzog}
              compact
            />
          </div>

          {duplungOn ? (
            <p
              className="rounded-xl border-2 border-ink/20 bg-subtle px-3 py-2.5 text-[16px] font-semibold text-ink"
              role="status"
            >
              {duplungStatusLabel(quantity)}
            </p>
          ) : null}

          {panthelyOn && machining?.panthely ? (
            <div className="space-y-3 rounded-2xl border-2 border-ink/20 bg-surface p-3.5">
              <p className="text-[17px] font-semibold text-ink">
                {MACHINING_COPY.panthelyTitle}
              </p>
              <div>
                <p className="mb-1.5 text-[14px] font-medium text-ink-secondary">
                  {MACHINING_COPY.panthelyQty}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PANTHELY_QTY_CHIPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onPanthelyQty(n)}
                      className={cn(
                        'flex size-12 items-center justify-center rounded-xl border-2 text-[18px] font-semibold tabular-nums transition',
                        machining.panthely!.quantity === n
                          ? 'border-ink bg-ink text-white'
                          : 'border-border bg-subtle text-ink'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[14px] font-medium text-ink-secondary">
                  {MACHINING_COPY.panthelySide}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      {
                        id: 'hosszu' as const,
                        label: MACHINING_COPY.panthelyLong
                      },
                      {
                        id: 'rovid' as const,
                        label: MACHINING_COPY.panthelyShort
                      }
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onPanthelyOldal(o.id)}
                      className={cn(
                        'h-12 rounded-xl border-2 px-4 text-[15px] font-semibold transition',
                        machining.panthely!.oldal === o.id
                          ? 'border-ink bg-ink text-white'
                          : 'border-border bg-subtle text-ink'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {szogOn && machining?.szog && canPreview && grainMm && crossMm ? (
            <div className="space-y-3 rounded-2xl border-2 border-ink/20 bg-surface p-3.5">
              <div>
                <p className="text-[17px] font-semibold text-ink">
                  {MACHINING_COPY.szogTitle}
                </p>
                <p className="mt-0.5 text-[14px] text-ink-secondary">
                  {MACHINING_COPY.szogIntro}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[14px] font-semibold text-ink">
                    {MACHINING_COPY.remainGrain}
                  </span>
                  <Input
                    inputMode="numeric"
                    value={String(
                      remainFromCut(grainMm, machining.szog.alongGrainMm)
                    )}
                    className="h-12 text-[18px] font-semibold tabular-nums"
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, ''))
                      if (!Number.isFinite(n)) return
                      onSzogAlong({
                        alongGrainMm: cutFromRemain(grainMm, n)
                      })
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[14px] font-semibold text-ink">
                    {MACHINING_COPY.remainCross}
                  </span>
                  <Input
                    inputMode="numeric"
                    value={String(
                      remainFromCut(crossMm, machining.szog.alongCrossMm)
                    )}
                    className="h-12 text-[18px] font-semibold tabular-nums"
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, ''))
                      if (!Number.isFinite(n)) return
                      onSzogAlong({
                        alongCrossMm: cutFromRemain(crossMm, n)
                      })
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}

function MachiningToggleTile({
  title,
  hint,
  Icon,
  active,
  onClick,
  compact
}: {
  title: string
  hint: string
  Icon: typeof Layers
  active: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-1.5 rounded-2xl border-2 text-left transition',
        compact ? 'min-h-[96px] p-3' : 'min-h-[120px] p-4 gap-2',
        active
          ? 'border-ink bg-subtle ring-2 ring-ink'
          : 'border-border bg-surface hover:border-ink/35'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-xl',
          compact ? 'size-10' : 'size-12',
          active ? 'bg-ink text-white' : 'bg-subtle text-ink'
        )}
      >
        <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden />
      </span>
      <span
        className={cn(
          'font-semibold text-ink',
          compact ? 'text-[15px]' : 'text-[18px]'
        )}
      >
        {title}
      </span>
      <span className="text-[13px] text-ink-secondary">{hint}</span>
      {active ? (
        <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-ink">
          <Check className="size-3.5" aria-hidden />
          Be
        </span>
      ) : null}
    </button>
  )
}

function EdgeStep({
  sheet,
  grainMm,
  crossMm,
  draft,
  edges,
  onSetSlot
}: {
  sheet: KioskSheet
  grainMm: number
  crossMm: number
  draft: DraftPanel
  edges: KioskEdge[]
  onSetSlot: (slot: EdgeSlot, edgeTypeId: string | null) => void
}) {
  const duplung = Boolean(draft.machining?.duplungolas)
  const types = edges
  const showFerde = Boolean(draft.machining?.szog)
  const summary = edgeSummaryLabel(draft.edgeIds)

  const rows = showFerde
    ? EDGE_SLOT_UI
    : EDGE_SLOT_UI.filter((e) => e.slot !== 'ferde')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold text-ink md:text-[26px]">
            Hol legyen élzáró?
          </h1>
          <p className="text-[14px] text-ink-secondary">{EDGE_COPY.stepSub}</p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1">
          <span
            className="size-8 shrink-0 rounded-md border border-border"
            style={sheetFillStyle(sheet)}
            aria-hidden
          />
          <p className="min-w-0 truncate text-[14px] font-medium text-ink">
            {sheet.name}, {sheet.thicknessMm} mm · {grainMm}×{crossMm}
            {duplung ? ' · duplung' : ''}
          </p>
        </div>
      </div>

      <p className="flex items-center gap-2.5 rounded-xl border-2 border-ink/15 bg-surface px-4 py-2.5 text-[16px] text-ink">
        <Layers className="size-5 shrink-0 text-ink-muted" aria-hidden />
        <span>
          <span className="font-semibold">Nézd meg az élzáró mintákat</span>{' '}
          a kiosk mellett. Ott megfoghatod és összevetheted a lappal.
        </span>
      </p>

      <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-5">
        <KioskMachiningPreview
          grainMm={grainMm}
          crossMm={crossMm}
          swatch={sheet.swatch}
          imageUrl={sheet.imageUrl}
          grainDirection={sheet.grainDirection}
          quantity={draft.quantity}
          machining={draft.machining}
          edgeIds={draft.edgeIds}
          compact
          caption={summary === 'Nincs él' ? '' : summary}
        />

        <div className="overflow-hidden rounded-xl border-2 border-border bg-surface">
          <div className="grid grid-cols-[8.5rem_1fr] border-b border-border bg-subtle px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            <span>Él</span>
            <span>Típus</span>
          </div>
          {types.length === 0 ? (
            <p className="px-3 py-4 text-[14px] text-ink-muted">
              Nincs hozzárendelt élzáró típus. Él nélkül is mehetsz tovább, vagy
              kérj segítséget a pultnál.
            </p>
          ) : null}
          {rows.map(({ slot, label, badge }, i) => {
            const value = draft.edgeIds[slot] ?? ''
            const selected = types.find((t) => t.typeId === value)
            return (
              <div
                key={slot}
                className={cn(
                  'grid grid-cols-[8.5rem_1fr] items-center gap-2 px-3 py-2',
                  i < rows.length - 1 && 'border-b border-border'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                      selected
                        ? 'bg-ink text-white'
                        : 'border border-border bg-subtle text-ink-muted'
                    )}
                    aria-hidden
                  >
                    {badge}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">
                    {label}
                  </span>
                </div>
                <MenuSelect
                  value={value}
                  allowEmpty
                  emptyLabel="Nincs"
                  placeholder="Válassz típust"
                  className="min-w-0"
                  triggerClassName="h-12 border-2 text-[14px] font-medium"
                  disabled={types.length === 0}
                  options={types.map((t) => ({
                    value: t.typeId,
                    label: t.name
                  }))}
                  onChange={(id) => onSetSlot(slot, id ? id : null)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CartStep({
  cart,
  sheets,
  priceStatus,
  priceError,
  pricedMaterials,
  onEdit,
  onAskDelete,
  onAddSame,
  onAddMore,
  onRunPrice
}: {
  cart: KioskCartLine[]
  sheets: KioskSheet[]
  priceStatus: PriceStatus
  priceError: string | null
  pricedMaterials: KioskPriceMaterialExplain[] | null
  onEdit: (l: KioskCartLine) => void
  onAskDelete: (id: string) => void
  onAddSame: (sheetId: string) => void
  onAddMore: () => void
  onRunPrice: () => void
}) {
  const [explainMaterialId, setExplainMaterialId] = useState<string | null>(
    null
  )

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { sheetId: string; sheet: KioskSheet | undefined; rows: KioskCartLine[] }
    >()
    for (const line of cart) {
      const existing = map.get(line.sheetId)
      if (existing) {
        existing.rows.push(line)
      } else {
        map.set(line.sheetId, {
          sheetId: line.sheetId,
          sheet: sheets.find((x) => x.id === line.sheetId),
          rows: [line]
        })
      }
    }
    return Array.from(map.values())
  }, [cart, sheets])

  const totalPieces = cart.reduce((s, l) => s + l.quantity, 0)
  const hasOrderSheet = groups.some((g) => g.sheet && !g.sheet.onStock)
  const explainMaterial =
    explainMaterialId && pricedMaterials
      ? (pricedMaterials.find((m) => m.materialId === explainMaterialId) ??
        null)
      : null
  const explainSheet = explainMaterialId
    ? sheets.find((x) => x.id === explainMaterialId)
    : undefined
  const canExplain = priceStatus === 'ok' && Boolean(pricedMaterials?.length)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold text-ink md:text-[32px]">
          Nézd át a rendelésed
        </h1>
        {cart.length > 0 ? (
          <p className="text-[15px] tabular-nums text-ink-secondary">
            {cart.length} panel · {totalPieces} db · {groups.length} anyag
          </p>
        ) : null}
      </div>

      {cart.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-[16px] text-ink-secondary">
          A kosár üres. Válassz lapot.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const s = group.sheet
            const groupPieces = group.rows.reduce((n, r) => n + r.quantity, 0)
            const matExplain = pricedMaterials?.find(
              (m) => m.materialId === group.sheetId
            )
            const groupGross =
              priceStatus === 'ok' && matExplain
                ? matExplain.totalGross
                : null
            const hasExplainForGroup = canExplain && Boolean(matExplain)
            const groupHasLabel = group.rows.some((r) => r.label?.trim())
            return (
              <div
                key={group.sheetId}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-border border-l-[3px] border-l-primary bg-subtle px-3 py-2.5">
                  <span
                    className="size-10 shrink-0 rounded-md border border-border"
                    style={
                      s
                        ? sheetFillStyle(s)
                        : { background: 'var(--color-subtle)' }
                    }
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-ink">
                      {s?.name ?? 'Lap'}
                      {s ? `, ${s.thicknessMm} mm` : ''}
                    </p>
                    <p className="text-[13px] tabular-nums text-ink-secondary">
                      {group.rows.length} panel · {groupPieces} db
                    </p>
                    {hasExplainForGroup ? (
                      <button
                        type="button"
                        className="mt-0.5 text-left text-[13px] font-medium text-ink underline-offset-2 hover:underline"
                        aria-label={`Hogyan jött ki az ár: ${s?.name ?? 'lap'}`}
                        onClick={() => setExplainMaterialId(group.sheetId)}
                      >
                        Hogyan jött ki ez az ár?
                      </button>
                    ) : priceStatus === 'stale' ||
                      priceStatus === 'none' ||
                      priceStatus === 'error' ? (
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        Árszámítás után látszik az anyag ára
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {groupGross != null ? (
                      <p className="text-[16px] font-semibold tabular-nums text-ink">
                        {formatHuf(groupGross)}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 shrink-0 text-[14px]"
                      onClick={() => onAddSame(group.sheetId)}
                    >
                      + Ugyanebből még
                    </Button>
                  </div>
                </div>

                {priceStatus === 'ok' && matExplain && matExplain.fullBoardCount > 0 ? (
                  <p className="flex items-start gap-2 border-b border-border px-3 py-2 text-[14px] text-ink">
                    <PackageCheck
                      className="mt-0.5 size-4 shrink-0 text-success-ink"
                      aria-hidden
                    />
                    {LEFTOVER_COPY.cart}
                  </p>
                ) : null}

                <DataTable className="rounded-none border-0">
                  <DataTableHead>
                    <DataTableRow>
                      {groupHasLabel ? (
                        <DataTableHeaderCell>Megnevezés</DataTableHeaderCell>
                      ) : null}
                      <DataTableHeaderCell align="right">
                        Szálirány
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Keresztirány
                      </DataTableHeaderCell>
                      <DataTableHeaderCell align="right">
                        Darab
                      </DataTableHeaderCell>
                      <DataTableHeaderCell>Megmunkálás</DataTableHeaderCell>
                      <DataTableHeaderCell>Élzárás</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                        <span className="sr-only">Törlés</span>
                      </DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {group.rows.map((line) => {
                      const chips = machiningSummaryChips(line.machining)
                      const edgeChips = edgeCartChips(line.edgeIds)
                      return (
                        <DataTableRow
                          key={line.id}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer transition-colors hover:bg-subtle"
                          onClick={() => onEdit(line)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onEdit(line)
                            }
                          }}
                        >
                          {groupHasLabel ? (
                            <DataTableCell className="max-w-[12rem] truncate text-[15px] font-medium">
                              {line.label?.trim() ? (
                                line.label
                              ) : (
                                <span className="font-normal text-ink-muted">
                                  Nincs
                                </span>
                              )}
                            </DataTableCell>
                          ) : null}
                          <DataTableCell
                            align="right"
                            className="text-[15px] tabular-nums"
                          >
                            {line.grainMm}{' '}
                            <span className="text-ink-muted">mm</span>
                          </DataTableCell>
                          <DataTableCell
                            align="right"
                            className="text-[15px] tabular-nums"
                          >
                            {line.crossMm}{' '}
                            <span className="text-ink-muted">mm</span>
                          </DataTableCell>
                          <DataTableCell
                            align="right"
                            className="text-[15px] tabular-nums"
                          >
                            {line.quantity}
                          </DataTableCell>
                          <DataTableCell className="max-w-[12rem]">
                            {chips.length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {chips.map((label) => (
                                  <span
                                    key={label}
                                    className="whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[12px] font-medium text-white"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-ink-muted">Nincs</span>
                            )}
                          </DataTableCell>
                          <DataTableCell className="min-w-[10rem]">
                            {edgeChips.length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {edgeChips.map((c) => (
                                  <span
                                    key={c.key}
                                    className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded border border-border bg-white px-1.5 py-0.5 text-[12px] text-ink"
                                    title={`${c.badge} · ${c.name}`}
                                  >
                                    <span className="font-semibold text-ink">
                                      {c.badge}
                                    </span>
                                    <span className="truncate text-ink-secondary">
                                      {c.name}
                                    </span>
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-ink-muted">Él nélkül</span>
                            )}
                          </DataTableCell>
                          <DataTableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-10 p-0 text-danger-ink hover:text-danger-ink"
                              aria-label="Tétel törlése"
                              onClick={(e) => {
                                e.stopPropagation()
                                onAskDelete(line.id)
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </DataTableCell>
                        </DataTableRow>
                      )
                    })}
                  </DataTableBody>
                </DataTable>
              </div>
            )
          })}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full text-[16px] sm:w-auto"
        onClick={onAddMore}
      >
        + Másik anyag
      </Button>

      {cart.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
          <div className="space-y-1 text-[15px] text-ink-secondary">
            <p className="font-semibold text-ink">Mikor lesz kész?</p>
            {hasOrderSheet ? (
              <p>
                Rendelésre lapot is választottál. Ezt be kell szereznünk, ezért
                több idő, mire elkészül. A pultnál megmondjuk, mikorra várható.
              </p>
            ) : (
              <p>A pultnál megmondjuk, mikorra várható.</p>
            )}
            <p>Ha elkészült, SMS-ben szólunk.</p>
          </div>
        </div>
      ) : null}

      {priceError ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft/40 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[14px] text-danger-ink">
            {priceError}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="h-9 text-[13px]"
            onClick={onRunPrice}
          >
            Újra
          </Button>
        </div>
      ) : null}

      <KioskPriceExplainSheet
        open={Boolean(explainMaterial)}
        onOpenChange={(open) => {
          if (!open) setExplainMaterialId(null)
        }}
        material={explainMaterial}
        thicknessMm={explainSheet?.thicknessMm}
      />
    </div>
  )
}
