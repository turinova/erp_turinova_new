'use client'

import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  CircleDot,
  Clock,
  Copy,
  Eye,
  Layers,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  Replace,
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

import { CartPanelThumb } from '@/components/kiosk/cart/cart-panel-thumb'
import { KioskMachiningPreview } from '@/components/kiosk/kiosk-machining-preview'
import { KioskPriceExplainSheet } from '@/components/kiosk/kiosk-price-explain-sheet'
import { KioskAttract } from '@/components/kiosk/attract/kiosk-attract'
import { KioskShell } from '@/components/kiosk/kiosk-shell'
import { KioskDetailsStep } from '@/components/kiosk/details/kiosk-details-step'
import { KioskSuccessStep } from '@/components/kiosk/details/kiosk-success-step'
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
  applyRecolorCart,
  type RecolorMode
} from '@/lib/kiosk/recolor-cart'
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
      <span className="pointer-events-none absolute bottom-3 left-1/2 z-[2] -translate-x-1/2 rounded-lg bg-ink px-3.5 py-1.5 text-[18px] font-semibold tracking-wide text-white shadow-sm">
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

/** Méret rajz: kezdő (mérés előtti) és max panel-keret (px); 24″ FHD-n a jobb oldalt tölti ki. */
const SIZE_STAGE_INNER_W = 420
const SIZE_STAGE_INNER_H = 300
const SIZE_STAGE_MAX_W = 1200
const SIZE_STAGE_MAX_H = 720
/** Méretvonalak helye a panel felett / mellett — 24″, 50+ olvasható. */
const SIZE_DIM_TOP_H = 100
const SIZE_DIM_SIDE_W = 200

function SizeDimLine({
  orientation,
  caption,
  value,
  active
}: {
  orientation: 'horizontal' | 'vertical'
  caption: string
  value: number | null
  active: boolean
}) {
  const tone = active ? 'bg-ink' : 'bg-ink/35'
  const label = (
    <span
      className={cn(
        'inline-flex flex-col rounded-lg px-3 py-1.5 leading-tight transition-colors',
        orientation === 'vertical' ? 'items-end text-right' : 'items-center',
        active ? 'bg-ink text-white' : 'text-ink'
      )}
    >
      <span
        className={cn(
          'text-[20px] font-semibold',
          active ? 'text-white/90' : 'text-ink-secondary'
        )}
      >
        {caption}
      </span>
      <span className="whitespace-nowrap text-[40px] font-semibold tabular-nums leading-none">
        {value != null ? `${value} mm` : '- mm'}
      </span>
    </span>
  )

  if (orientation === 'horizontal') {
    return (
      <div className="flex flex-col justify-end gap-1.5 pb-2" aria-hidden>
        <div className="flex justify-center">{label}</div>
        <div className="relative h-3">
          <span className={cn('absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2', tone)} />
          <span className={cn('absolute left-0 top-0 h-3 w-0.5', tone)} />
          <span className={cn('absolute right-0 top-0 h-3 w-0.5', tone)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2 pr-2" aria-hidden>
      {label}
      <div className="relative h-full w-3 shrink-0">
        <span className={cn('absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2', tone)} />
        <span className={cn('absolute left-0 top-0 h-0.5 w-3', tone)} />
        <span className={cn('absolute bottom-0 left-0 h-0.5 w-3', tone)} />
      </div>
    </div>
  )
}

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

/** Enter = primary tovább (select/menü nyitva hagyva). */
function useKioskEnterContinue(canContinue: boolean, onContinue: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (!t) return
      if (t.closest('textarea')) return
      if (t.closest('[role="listbox"]')) return
      if (t.closest('[role="menu"]')) return
      if (t.closest('[role="combobox"]')) return
      if (t.getAttribute('role') === 'option') return
      if (t.tagName === 'BUTTON') return
      if (!canContinue) return
      e.preventDefault()
      onContinue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canContinue, onContinue])
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
  /** Sor / szín-csoport / teljes kosár törlés megerősítés. */
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { kind: 'line'; id: string }
    | { kind: 'group'; sheetId: string }
    | { kind: 'all' }
    | null
  >(null)
  /** Anyag lépés: dekor csere vagy másolás. */
  const [recolorPending, setRecolorPending] = useState<{
    sourceSheetId: string
    mode: RecolorMode
    thicknessMm: number
  } | null>(null)
  const [recolorError, setRecolorError] = useState<{
    title: string
    detailErrors?: string[]
  } | null>(null)
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
    let pool = catalogSheets
    if (recolorPending) {
      pool = pool.filter(
        (s) =>
          s.thicknessMm === recolorPending.thicknessMm &&
          s.id !== recolorPending.sourceSheetId
      )
    }
    const filtered = pool.filter((s) =>
      menuSearchMatch(
        `${s.name} ${s.manufacturerName} ${s.machineCode} ${s.thicknessMm}mm ${s.lengthMm} ${s.widthMm}`,
        materialQuery
      )
    )
    return filtered.sort((a, b) => {
      if (a.onStock !== b.onStock) return a.onStock ? -1 : 1
      return a.name.localeCompare(b.name, 'hu')
    })
  }, [catalogSheets, materialQuery, recolorPending])

  /** Üres keresés: quote-gyakoriság (bootstrap), max 8. Recolor: azonos vastagság. */
  const featuredStock = useMemo(() => {
    const base = bootstrap.featuredSheets
    if (!recolorPending) return base
    return base.filter(
      (s) =>
        s.thicknessMm === recolorPending.thicknessMm &&
        s.id !== recolorPending.sourceSheetId
    )
  }, [bootstrap.featuredSheets, recolorPending])

  const recolorSourceSheet = recolorPending
    ? catalogSheets.find((s) => s.id === recolorPending.sourceSheetId)
    : null

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
    setDeleteConfirm(null)
    setRecolorPending(null)
    setRecolorError(null)
    setMaterialQuery('')
    setPriceStatus('none')
    setPricedTotalGross(null)
    setPricedMaterials(null)
    setPriceError(null)
  }

  function selectSheet(s: KioskSheet) {
    if (recolorPending) {
      finishRecolor(s)
      return
    }
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

  function beginRecolor(sheetId: string, mode: RecolorMode) {
    const s = catalogSheets.find((x) => x.id === sheetId)
    if (!s) return
    setRecolorPending({
      sourceSheetId: sheetId,
      mode,
      thicknessMm: s.thicknessMm
    })
    setMaterialQuery('')
    setStep('material')
  }

  function confirmDelete() {
    if (!deleteConfirm) return
    if (deleteConfirm.kind === 'line') {
      setCart((c) => c.filter((l) => l.id !== deleteConfirm.id))
    } else if (deleteConfirm.kind === 'group') {
      setCart((c) => c.filter((l) => l.sheetId !== deleteConfirm.sheetId))
    } else {
      setCart([])
    }
    markPriceStale()
    setDeleteConfirm(null)
  }

  function finishRecolor(target: KioskSheet) {
    if (!recolorPending) return
    const mode = recolorPending.mode
    const result = applyRecolorCart({
      cart,
      sourceSheetId: recolorPending.sourceSheetId,
      target,
      mode,
      maxRows,
      allowedTypeIds
    })
    if (!result.ok) {
      setRecolorError({
        title: result.error,
        detailErrors: result.detailErrors
      })
      return
    }
    setCart(result.cart)
    markPriceStale()
    setRecolorPending(null)
    setMaterialQuery('')
    setStep('cart')
    toast.success(
      mode === 'copy'
        ? `Másolva: ${result.movedOrCopied} tétel → ${target.name}`
        : `Dekor csere: ${result.movedOrCopied} tétel → ${target.name}`
    )
    if (result.edgesDropped) {
      toast.message(
        'Néhány élzárást nem tudtunk átvinni. Nézd át a kosárban az él oszlopot.'
      )
    }
  }

  function cancelRecolor() {
    setRecolorPending(null)
    setRecolorError(null)
    setMaterialQuery('')
    setStep('cart')
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
            label: 'Ár kiszámítása',
            disabled: true,
            hint: 'A kosár üres.'
          }
        }
        if (priceStatus === 'loading' || pricePending) {
          return {
            label: 'Ár kiszámítása',
            disabled: true
          }
        }
        if (priceStatus !== 'ok' || pricedTotalGross == null) {
          return {
            label: 'Ár kiszámítása',
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
          label: `Tovább · ${formatHuf(pricedTotalGross)} →`,
          disabled: false,
          onClick: () => setStep('details')
        }
      }
      case 'details': {
        const v = validateKioskGuest(guest)
        return {
          label:
            pricedTotalGross != null
              ? `Leadom a pultnak · ${formatHuf(pricedTotalGross)}`
              : 'Leadom a pultnak',
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
        if (recolorPending) {
          cancelRecolor()
        } else {
          setStep('attract')
        }
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
      wide={
        step === 'material' ||
        step === 'size' ||
        step === 'machining' ||
        step === 'edge' ||
        step === 'cart' ||
        step === 'details' ||
        step === 'success'
      }
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
          totalCount={
            recolorPending
              ? catalogSheets.filter(
                  (s) =>
                    s.thicknessMm === recolorPending.thicknessMm &&
                    s.id !== recolorPending.sourceSheetId
                ).length
              : catalogSheets.length
          }
          query={materialQuery}
          onQuery={setMaterialQuery}
          onSelect={selectSheet}
          recolor={
            recolorPending && recolorSourceSheet
              ? {
                  mode: recolorPending.mode,
                  thicknessMm: recolorPending.thicknessMm,
                  sourceName: recolorSourceSheet.name
                }
              : null
          }
          onCancelRecolor={recolorPending ? cancelRecolor : undefined}
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
          canContinue={!sizeHardBlock}
          onContinue={goMachining}
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
          canContinue={isMachiningReady(draft.machining, grainMm, crossMm)}
          onContinue={goEdge}
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
          canContinue={
            !sizeHardBlock &&
            isMachiningReady(draft.machining, grainMm, crossMm)
          }
          onContinue={addToCart}
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
          onAskDeleteLine={(id) => setDeleteConfirm({ kind: 'line', id })}
          onAskDeleteGroup={(sheetId) =>
            setDeleteConfirm({ kind: 'group', sheetId })
          }
          onAskClearCart={() => setDeleteConfirm({ kind: 'all' })}
          onAddSame={addSameSheet}
          onRecolorMove={(sheetId) => beginRecolor(sheetId, 'move')}
          onRecolorCopy={(sheetId) => beginRecolor(sheetId, 'copy')}
          onAddMore={() => {
            setDraft(EMPTY_DRAFT)
            setStep('material')
          }}
          onRunPrice={runPrice}
          canEnterPrimary={
            !deleteConfirm &&
            !recolorError &&
            cart.length > 0 &&
            priceStatus !== 'loading' &&
            !pricePending
          }
          onEnterPrimary={() => {
            if (priceStatus === 'ok' && pricedTotalGross != null) {
              setStep('details')
              return
            }
            runPrice()
          }}
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

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-elev3">
            <p className="text-[18px] font-semibold text-ink">
              {deleteConfirm.kind === 'line'
                ? 'Törlöd ezt a darabot?'
                : deleteConfirm.kind === 'group'
                  ? 'Törlöd ezt a színt a kosárból?'
                  : 'Kiüríted a teljes kosarat?'}
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-12 flex-1 text-[15px]"
                autoFocus
                onClick={() => setDeleteConfirm(null)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                variant="danger"
                className="h-12 flex-1 text-[15px]"
                onClick={confirmDelete}
              >
                Törlés
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {recolorError ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-recolor-error-title"
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-elev3"
          >
            <p
              id="kiosk-recolor-error-title"
              className="text-[20px] font-semibold text-ink"
            >
              {recolorError.title}
            </p>
            {recolorError.detailErrors &&
            recolorError.detailErrors.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-ink-secondary">
                {recolorError.detailErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6">
              <Button
                type="button"
                className="h-12 w-full text-[15px]"
                autoFocus
                onClick={() => setRecolorError(null)}
              >
                Értem, másikat választok
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </KioskShell>
  )
}

function MaterialStep({
  sheets,
  featuredStock,
  totalCount,
  query,
  onQuery,
  onSelect,
  recolor,
  onCancelRecolor
}: {
  sheets: KioskSheet[]
  featuredStock: KioskSheet[]
  totalCount: number
  query: string
  onQuery: (q: string) => void
  onSelect: (s: KioskSheet) => void
  recolor?: {
    mode: RecolorMode
    thicknessMm: number
    sourceName: string
  } | null
  onCancelRecolor?: () => void
}) {
  const hasQuery = query.trim().length > 0
  const [thicknessMm, setThicknessMm] = useState<number | null>(null)
  const [stockOnly, setStockOnly] = useState(false)

  useEffect(() => {
    setThicknessMm(null)
    setStockOnly(false)
  }, [recolor?.mode, recolor?.thicknessMm, recolor?.sourceName])

  /** Gyakori + featured vastagságok (max 8) — a teljes lista kioskban zsúfolt. */
  const thicknessOptions = useMemo(() => {
    const counts = new Map<number, number>()
    for (const s of sheets) {
      counts.set(s.thicknessMm, (counts.get(s.thicknessMm) ?? 0) + 1)
    }
    const preferred = [18, 16, 12, 10, 8, 3]
    const fromFeatured = featuredStock.map((s) => s.thicknessMm)
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
      .map(([mm]) => mm)
    const picked: number[] = []
    for (const mm of [...preferred, ...fromFeatured, ...ranked]) {
      if (!counts.has(mm) || picked.includes(mm)) continue
      picked.push(mm)
      if (picked.length >= 8) break
    }
    return picked.sort((a, b) => b - a)
  }, [sheets, featuredStock])

  const filtersActive = thicknessMm != null || stockOnly
  /**
   * Üres keresés: kiemeltek elöl, utána a katalógus többi lapja.
   * Keresés / recolor / szűrő: a teljes (már szűrt) sheets lista.
   */
  const base = useMemo(() => {
    if (hasQuery || recolor) return sheets
    const featuredIds = new Set(featuredStock.map((s) => s.id))
    const rest = sheets.filter((s) => !featuredIds.has(s.id))
    return [...featuredStock, ...rest]
  }, [hasQuery, recolor, sheets, featuredStock])

  const list = useMemo(
    () =>
      base.filter((s) => {
        if (thicknessMm != null && s.thicknessMm !== thicknessMm) return false
        if (stockOnly && !s.onStock) return false
        return true
      }),
    [base, thicknessMm, stockOnly]
  )

  function clearFilters() {
    setThicknessMm(null)
    setStockOnly(false)
    onQuery('')
  }

  const title = recolor
    ? recolor.mode === 'copy'
      ? 'Másolás — új dekor'
      : 'Dekor csere'
    : 'Válaszd ki a lapot'

  const gridTitle = hasQuery
    ? 'Keresési találatok'
    : recolor
      ? `Azonos vastagság (${recolor.thicknessMm} mm)`
      : filtersActive
        ? 'Szűrt lapok'
        : 'Összes lap'

  const gridSubtitle = hasQuery
    ? 'Koppints egy lapra a folytatáshoz.'
    : recolor
      ? 'Koppints egy lapra a folytatáshoz.'
      : filtersActive
        ? 'Koppints egy lapra a folytatáshoz.'
        : 'Elöl a legnépszerűbbek, utána a teljes katalógus.'

  const countLabel = hasQuery
    ? `${list.length} találat`
    : recolor
      ? `${list.length} / ${totalCount} lap · ${recolor.thicknessMm} mm`
      : `${list.length} lap`

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-b border-border bg-surface px-6 py-6 md:px-8 lg:h-full lg:w-[400px] lg:border-b-0 lg:border-r lg:px-8 lg:py-8">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink lg:text-[36px]">
            {title}
          </h1>
          {!recolor ? (
            <p className="mt-2 text-[16px] text-ink-secondary">
              Írd be a dekór nevét vagy kódját, vagy válassz jobbra. Elöl a
              népszerűek, utána az összes lap.
            </p>
          ) : null}
        </div>

        {recolor ? (
          <div className="rounded-xl border border-ink/15 bg-subtle px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1 text-[15px] text-ink">
                <p className="font-semibold">
                  {recolor.mode === 'copy' ? 'Másolás' : 'Dekor csere'}:{' '}
                  {recolor.sourceName}
                </p>
                <p className="text-ink-secondary">
                  Csak {recolor.thicknessMm} mm vastag lapok. A méretek, él és
                  megmunkálás megmarad.
                </p>
              </div>
              {onCancelRecolor ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 shrink-0 text-[14px]"
                  onClick={onCancelRecolor}
                >
                  Mégse
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="pl. tölgy, Egger, H1145"
            autoComplete="off"
            autoFocus
            enterKeyHint="search"
            className="h-16 border-border bg-app pl-12 pr-12 text-[18px] shadow-sm"
            aria-label="Lap keresése"
          />
          {hasQuery ? (
            <Button
              type="button"
              variant="ghost"
              className="absolute right-1.5 top-1/2 size-12 -translate-y-1/2 p-0"
              aria-label="Keresés törlése"
              onClick={() => onQuery('')}
            >
              <X className="size-5" aria-hidden />
            </Button>
          ) : null}
        </div>

        {!recolor && thicknessOptions.length > 1 ? (
          <div>
            <p className="mb-2.5 text-[14px] font-semibold text-ink">
              Vastagság
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Vastagság szűrő"
            >
              <FilterChip
                active={thicknessMm == null}
                onClick={() => setThicknessMm(null)}
              >
                Mind
              </FilterChip>
              {thicknessOptions.map((mm) => (
                <FilterChip
                  key={mm}
                  active={thicknessMm === mm}
                  onClick={() =>
                    setThicknessMm((prev) => (prev === mm ? null : mm))
                  }
                >
                  {mm} mm
                </FilterChip>
              ))}
            </div>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-app px-4 py-3.5 text-[16px] font-medium text-ink">
          <input
            type="checkbox"
            checked={stockOnly}
            onChange={(e) => setStockOnly(e.target.checked)}
            className="size-5 rounded border-border accent-ink"
          />
          Csak raktáron
        </label>

        <div className="mt-auto space-y-3 border-t border-border pt-5 text-[15px] leading-snug text-ink-secondary">
          <p>
            <span className="font-semibold text-ink">Rendelésre</span> = be kell
            szereznünk, ezért több idő, mire elkészül.
          </p>
          <p>
            Nem találod?{' '}
            <span className="font-semibold text-ink">Kérdezd a pultot.</span>
          </p>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-app px-5 py-5 md:px-8 lg:h-full lg:py-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[22px] font-semibold text-ink">{gridTitle}</h2>
            {hasQuery && sheets.length === 0 ? null : (
              <p className="mt-0.5 text-[15px] text-ink-secondary">
                {gridSubtitle}
              </p>
            )}
          </div>
          <p className="text-[15px] tabular-nums text-ink-muted">{countLabel}</p>
        </div>

        {hasQuery && sheets.length === 0 ? (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <p className="text-[17px] text-ink">
              Nincs ilyen dekór. Próbáld a kódot, vagy kérdezd a pultot.
            </p>
            {featuredStock.length > 0 ? (
              <>
                <p className="text-[15px] text-ink-secondary">
                  Vagy ezek közül:
                </p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
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
              className="h-12 text-[15px]"
              onClick={() => onQuery('')}
            >
              Keresés törlése
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="space-y-4 rounded-xl border border-warning/30 bg-warning-soft p-5">
            <p className="text-[17px] text-warning-ink">
              {filtersActive
                ? 'Nincs ilyen lap a szűrőkkel. Próbáld a szűrők törlését.'
                : 'Most nincs választható lap. Gyere a pulthoz.'}
            </p>
            {filtersActive ? (
              <Button
                type="button"
                variant="secondary"
                className="h-12 text-[15px]"
                onClick={clearFilters}
              >
                Szűrők törlése
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
      </section>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-11 rounded-lg border px-3.5 text-[15px] font-semibold tabular-nums transition',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-border bg-app text-ink hover:border-ink/40'
      )}
    >
      {children}
    </button>
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
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-elev1 transition-[border-color,box-shadow] hover:border-ink hover:shadow-elev2 focus-visible:border-ink focus-visible:shadow-elev2 focus-visible:outline-none active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] w-full border-b border-border">
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
          <span className="rounded-md border border-border bg-white px-2 py-1 text-[14px] font-semibold tabular-nums text-ink shadow-sm">
            {s.thicknessMm} mm
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-3.5 py-3">
        <p className="line-clamp-2 text-[17px] font-semibold leading-snug text-ink">
          {highlightMatch(s.name, query)}
        </p>
        <p className="text-[15px] font-medium tabular-nums text-ink">
          {formatSheetDims(s)}
        </p>
        <p className="truncate text-[15px] text-ink-secondary">
          {highlightMatch(s.manufacturerName, query)}
          <span className="text-ink-muted"> · </span>
          <span className="tabular-nums">
            {formatHuf(s.pricePerSqmGross)}/m²
          </span>
        </p>
        {s.machineCode ? (
          <p className="truncate font-mono text-[13px] text-ink-muted">
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
  canContinue,
  onContinue,
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
  canContinue: boolean
  onContinue: () => void
  onChange: (p: Partial<DraftPanel>) => void
  onChangeSheet: () => void
}) {
  const grain = parseMm(draft.grainRaw)
  const cross = parseMm(draft.crossRaw)
  const [focusDim, setFocusDim] = useState<'grain' | 'cross' | null>(null)
  const grainInputRef = useRef<HTMLInputElement>(null)
  const crossInputRef = useRef<HTMLInputElement>(null)
  const grainHint = formatGrainMaxHint(sheet)
  const crossHint = formatCrossMaxHint(sheet)

  useEffect(() => {
    const id = window.setTimeout(() => {
      grainInputRef.current?.focus()
      grainInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [sheet.id, draft.editingLineId])

  const stageRef = useRef<HTMLDivElement>(null)
  const [stageBox, setStageBox] = useState({
    width: SIZE_STAGE_INNER_W,
    height: SIZE_STAGE_INNER_H
  })

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    function measure() {
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.round(
        Math.max(240, Math.min(SIZE_STAGE_MAX_W, r.width - SIZE_DIM_SIDE_W - 24))
      )
      const height = Math.round(
        Math.max(180, Math.min(SIZE_STAGE_MAX_H, r.height - SIZE_DIM_TOP_H - 24))
      )
      setStageBox((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const panelSize = useMemo(
    () => fitPanelSize(grain, cross, stageBox.width, stageBox.height),
    [grain, cross, stageBox]
  )
  const sizeLabel = grain && cross ? `${grain} × ${cross} mm` : '- × - mm'
  const labelInside = panelSize.width >= 220 && panelSize.height >= 72

  const hasFormMessage =
    (needsBothDims && hardErrors.length === 0) ||
    hardErrors.length > 0 ||
    Boolean(softWarn)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      {/* 1920×1080: bal mezők görgetés nélkül (~560 px). Hibák a jobb rajz fölé. */}
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-border bg-surface px-5 py-5 md:px-6 lg:h-full lg:w-[640px] lg:border-b-0 lg:border-r lg:py-6">
        <div className="flex h-16 items-center gap-3 rounded-xl border border-border bg-app px-3">
          <span
            className="size-11 shrink-0 rounded-md border border-border"
            style={sheetFillStyle(sheet)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight text-ink">
              {sheet.name}
            </p>
            <p className="truncate text-[14px] tabular-nums text-ink-secondary">
              {formatSheetDims(sheet)}
              <span className="mx-1.5 text-ink-muted">·</span>
              {sheet.onStock ? 'Raktáron' : 'Rendelésre'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 shrink-0 px-4 text-[15px]"
            onClick={onChangeSheet}
          >
            Csere
          </Button>
        </div>

        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink lg:text-[36px]">
            Mekkora legyen a lap?
          </h1>
          <p
            className="mt-1 text-[16px] leading-snug text-ink-secondary"
            role="note"
          >
            {FINISHED_SIZE_COPY.sizeStep}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block min-w-0">
            <span className="mb-1.5 flex items-center gap-1.5 text-[17px] font-semibold text-ink">
              <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
              Szálirány
            </span>
            <div className="relative">
              <Input
                ref={grainInputRef}
                inputMode="numeric"
                value={draft.grainRaw}
                placeholder="pl. 800"
                enterKeyHint="next"
                className={cn(
                  'h-[72px] pr-14 text-[32px] font-semibold tabular-nums',
                  focusDim === 'grain' && 'border-ink ring-2 ring-ink/20'
                )}
                onFocus={() => setFocusDim('grain')}
                onBlur={() => setFocusDim((d) => (d === 'grain' ? null : d))}
                onChange={(e) =>
                  onChange({
                    grainRaw: clampDimensionRaw(e.target.value, maxGrainMm)
                  })
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  crossInputRef.current?.focus()
                  crossInputRef.current?.select()
                }}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] font-medium text-ink-muted">
                mm
              </span>
            </div>
            <p className="mt-1 text-[14px] tabular-nums text-ink-muted">
              {grainHint}
            </p>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 flex items-center gap-1.5 text-[17px] font-semibold text-ink">
              <ArrowUpDown className="size-4 shrink-0" aria-hidden />
              Keresztirány
            </span>
            <div className="relative">
              <Input
                ref={crossInputRef}
                inputMode="numeric"
                value={draft.crossRaw}
                placeholder="pl. 400"
                enterKeyHint="done"
                className={cn(
                  'h-[72px] pr-14 text-[32px] font-semibold tabular-nums',
                  focusDim === 'cross' && 'border-ink ring-2 ring-ink/20'
                )}
                onFocus={() => setFocusDim('cross')}
                onBlur={() => setFocusDim((d) => (d === 'cross' ? null : d))}
                onChange={(e) =>
                  onChange({
                    crossRaw: clampDimensionRaw(e.target.value, maxCrossMm)
                  })
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (canContinue) onContinue()
                }}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] font-medium text-ink-muted">
                mm
              </span>
            </div>
            <p className="mt-1 text-[14px] tabular-nums text-ink-muted">
              {crossHint}
            </p>
          </label>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4">
          <div>
            <span className="mb-1.5 block text-[17px] font-semibold text-ink">
              Darab
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="size-14 p-0"
                aria-label="Kevesebb"
                onClick={() =>
                  onChange({ quantity: Math.max(1, draft.quantity - 1) })
                }
              >
                <Minus className="size-5" />
              </Button>
              <span className="min-w-[2.5rem] text-center text-[28px] font-semibold tabular-nums text-ink">
                {draft.quantity}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="size-14 p-0"
                aria-label="Több"
                onClick={() =>
                  onChange({
                    quantity: Math.min(maxQty, draft.quantity + 1)
                  })
                }
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>

          <label className="block min-w-0">
            <span className="mb-1.5 flex items-center gap-1.5 text-[17px] font-semibold text-ink">
              Megnevezés
              <span className="truncate font-normal text-ink-secondary">
                (nem kötelező, pl. Konyha ajtó)
              </span>
            </span>
            <Input
              value={draft.label}
              maxLength={KIOSK_LABEL_MAX}
              autoComplete="off"
              className="h-14 text-[18px]"
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </label>
        </div>
      </aside>

      <section className="flex min-h-[420px] min-w-0 flex-1 flex-col gap-3 bg-app px-6 py-5 md:px-10 lg:h-full lg:py-6">
        {hasFormMessage ? (
          <div className="shrink-0 space-y-2">
            {needsBothDims && hardErrors.length === 0 ? (
              <p
                className="rounded-xl border-2 border-ink/25 bg-subtle px-4 py-3 text-[20px] font-semibold leading-snug text-ink"
                role="status"
              >
                Írd be mindkét méretet milliméterben (mm).
              </p>
            ) : null}
            {hardErrors.map((e) => (
              <p
                key={e}
                className="rounded-xl border-2 border-danger/50 bg-danger-soft px-4 py-3 text-[20px] font-semibold leading-snug text-danger-ink"
                role="alert"
              >
                {e}
              </p>
            ))}
            {softWarn ? (
              <p
                className="rounded-xl border-2 border-warning/50 bg-warning-soft px-4 py-3 text-[20px] font-semibold leading-snug text-warning-ink"
                role="status"
              >
                {softWarn}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          ref={stageRef}
          className="flex min-h-0 flex-1 items-center justify-center"
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `${SIZE_DIM_SIDE_W}px ${panelSize.width}px`,
              gridTemplateRows: `${SIZE_DIM_TOP_H}px ${panelSize.height}px`
            }}
          >
            <div aria-hidden />
            <SizeDimLine
              orientation="horizontal"
              caption="Szálirány"
              value={grain}
              active={focusDim === 'grain'}
            />
            <SizeDimLine
              orientation="vertical"
              caption="Kereszt"
              value={cross}
              active={focusDim === 'cross'}
            />
            <div
              className={cn(
                'relative flex items-center justify-center overflow-hidden border-[3px] shadow-elev2 transition-[width,height,border-color] duration-200',
                focusDim ? 'border-ink' : 'border-ink/60'
              )}
              style={{
                width: panelSize.width,
                height: panelSize.height,
                ...sheetFillStyle(sheet)
              }}
            >
              {sheet.grainDirection ? <GrainOverlay /> : null}
              {labelInside ? (
                <span className="relative z-[3] rounded-lg bg-white px-5 py-2.5 text-[40px] font-semibold tabular-nums text-ink shadow-sm">
                  {sizeLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {!labelInside ? (
          <p className="shrink-0 text-center text-[40px] font-semibold tabular-nums text-ink">
            {sizeLabel}
          </p>
        ) : null}

        {sheet.grainDirection ? (
          <div
            className="flex shrink-0 items-center justify-center gap-2"
            role="note"
          >
            <span
              className="shrink-0 text-[28px] font-bold leading-none text-danger"
              aria-hidden
            >
              !
            </span>
            <p className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-2.5 text-[17px] font-semibold leading-snug text-danger-ink">
              Csak a <span className="underline">vonalak</span> mutatják a
              szálat. A kép iránya félrevezető lehet.
            </p>
          </div>
        ) : (
          <p className="shrink-0 text-center text-[17px] text-ink-secondary">
            Nincs szál. A két méret a két oldal.
          </p>
        )}
      </section>
    </div>
  )
}

function MachiningStep({
  sheet,
  grainMm,
  crossMm,
  quantity,
  machining,
  canContinue,
  onContinue,
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
  canContinue: boolean
  onContinue: () => void
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
  const canPreview =
    grainMm != null && crossMm != null && grainMm > 0 && crossMm > 0

  useKioskEnterContinue(canContinue, onContinue)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-border bg-surface px-6 py-6 md:px-8 lg:h-full lg:w-[460px] lg:border-b-0 lg:border-r lg:py-7">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-app p-3">
          <span
            className="size-14 shrink-0 rounded-lg border border-border"
            style={sheetFillStyle(sheet)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink">
              {sheet.name}
            </p>
            <p className="truncate text-[14px] tabular-nums text-ink-secondary">
              {canPreview
                ? `${grainMm} × ${crossMm} mm · ${quantity} db`
                : '- × - mm'}
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-[36px] font-semibold leading-tight tracking-tight text-ink lg:text-[40px]">
            {MACHINING_COPY.h1}
          </h1>
          <p className="mt-2 text-[16px] text-ink-secondary">
            {MACHINING_COPY.sub}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <MachiningToggleRow
            title={MACHINING_COPY.duplungTitle}
            hint={MACHINING_COPY.duplungHint}
            Icon={Layers}
            active={duplungOn}
            onClick={onToggleDuplung}
          >
            {duplungOn ? (
              <p
                className="rounded-xl border border-ink/15 bg-subtle px-3.5 py-3 text-[16px] font-semibold text-ink"
                role="status"
              >
                {duplungStatusLabel(quantity)}
              </p>
            ) : null}
          </MachiningToggleRow>

          <MachiningToggleRow
            title={MACHINING_COPY.panthelyTitle}
            hint={MACHINING_COPY.panthelyHint}
            Icon={CircleDot}
            active={panthelyOn}
            onClick={onTogglePanthely}
          >
            {panthelyOn && machining?.panthely ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[15px] font-semibold text-ink">
                    {MACHINING_COPY.panthelyQty}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PANTHELY_QTY_CHIPS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onPanthelyQty(n)}
                        className={cn(
                          'flex size-14 items-center justify-center rounded-xl border-2 text-[20px] font-semibold tabular-nums transition',
                          machining.panthely!.quantity === n
                            ? 'border-ink bg-ink text-white'
                            : 'border-border bg-app text-ink'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[15px] font-semibold text-ink">
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
                          'h-14 rounded-xl border-2 px-5 text-[16px] font-semibold transition',
                          machining.panthely!.oldal === o.id
                            ? 'border-ink bg-ink text-white'
                            : 'border-border bg-app text-ink'
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </MachiningToggleRow>

          <MachiningToggleRow
            title={MACHINING_COPY.szogTitle}
            hint={MACHINING_COPY.szogHint}
            Icon={Triangle}
            active={szogOn}
            onClick={onToggleSzog}
          >
            {szogOn && machining?.szog && canPreview && grainMm && crossMm ? (
              <div className="space-y-4">
                <p className="text-[15px] text-ink-secondary">
                  {MACHINING_COPY.szogIntro}
                </p>
                <div className="grid gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[15px] font-semibold text-ink">
                      {MACHINING_COPY.remainGrain}
                    </span>
                    <Input
                      inputMode="numeric"
                      value={String(
                        remainFromCut(grainMm, machining.szog.alongGrainMm)
                      )}
                      className="h-16 text-[24px] font-semibold tabular-nums"
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
                    <span className="mb-1.5 block text-[15px] font-semibold text-ink">
                      {MACHINING_COPY.remainCross}
                    </span>
                    <Input
                      inputMode="numeric"
                      value={String(
                        remainFromCut(crossMm, machining.szog.alongCrossMm)
                      )}
                      className="h-16 text-[24px] font-semibold tabular-nums"
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
          </MachiningToggleRow>
        </div>
      </aside>

      <section className="flex min-h-[360px] min-w-0 flex-1 flex-col bg-app px-6 py-6 md:px-10 lg:h-full lg:py-8">
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
            fillStage
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-subtle text-[20px] text-ink-muted">
            Előbb add meg a méretet
          </div>
        )}
      </section>
    </div>
  )
}

function MachiningToggleRow({
  title,
  hint,
  Icon,
  active,
  onClick,
  children
}: {
  title: string
  hint: string
  Icon: typeof Layers
  active: boolean
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 transition',
        active ? 'border-ink bg-subtle' : 'border-border bg-app'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
      >
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-xl',
            active ? 'bg-ink text-white' : 'bg-subtle text-ink'
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[20px] font-semibold text-ink">
            {title}
          </span>
          <span className="block text-[16px] text-ink-secondary">{hint}</span>
        </span>
        <span
          className={cn(
            'inline-flex h-10 min-w-16 shrink-0 items-center justify-center rounded-lg text-[16px] font-semibold',
            active
              ? 'bg-ink text-white'
              : 'border border-border bg-surface text-ink-secondary'
          )}
        >
          {active ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" aria-hidden />
              Be
            </span>
          ) : (
            'Ki'
          )}
        </span>
      </button>
      {active && children ? (
        <div className="border-t border-ink/10 px-4 py-4">{children}</div>
      ) : null}
    </div>
  )
}

function EdgeStep({
  sheet,
  grainMm,
  crossMm,
  draft,
  edges,
  canContinue,
  onContinue,
  onSetSlot
}: {
  sheet: KioskSheet
  grainMm: number
  crossMm: number
  draft: DraftPanel
  edges: KioskEdge[]
  canContinue: boolean
  onContinue: () => void
  onSetSlot: (slot: EdgeSlot, edgeTypeId: string | null) => void
}) {
  const duplung = Boolean(draft.machining?.duplungolas)
  const types = edges
  const showFerde = Boolean(draft.machining?.szog)
  const summary = edgeSummaryLabel(draft.edgeIds)

  const rows = showFerde
    ? EDGE_SLOT_UI
    : EDGE_SLOT_UI.filter((e) => e.slot !== 'ferde')

  useKioskEnterContinue(canContinue, onContinue)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      {/* 1920×1080: egy él = egy sor (~72 px), görgetés nélkül. */}
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-border bg-surface px-5 py-5 md:px-6 lg:h-full lg:w-[560px] lg:border-b-0 lg:border-r lg:py-6">
        <div className="flex h-16 items-center gap-3 rounded-xl border border-border bg-app px-3">
          <span
            className="size-11 shrink-0 rounded-md border border-border"
            style={sheetFillStyle(sheet)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight text-ink">
              {sheet.name}
            </p>
            <p className="truncate text-[14px] tabular-nums text-ink-secondary">
              {grainMm} × {crossMm} mm · {draft.quantity} db
              {duplung ? ' · duplung' : ''}
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink lg:text-[36px]">
            Hol legyen élzáró?
          </h1>
          <p className="mt-1 text-[16px] text-ink-secondary">{EDGE_COPY.stepSub}</p>
        </div>

        <p className="flex items-center gap-2 rounded-lg border border-ink/15 bg-app px-3 py-2 text-[15px] leading-snug text-ink">
          <Layers className="size-4 shrink-0 text-ink-secondary" aria-hidden />
          <span>
            <span className="font-semibold">Élzáró minták</span> a kiosk
            mellett — fogd meg és vesd össze a lappal.
          </span>
        </p>

        <div className="overflow-hidden rounded-2xl border-2 border-border">
          {types.length === 0 ? (
            <p className="px-4 py-4 text-[15px] text-ink-muted">
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
                  'flex items-center gap-3 px-3 py-2.5',
                  i < rows.length - 1 && 'border-b border-border'
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-md text-[20px] font-bold',
                    selected
                      ? 'bg-ink text-white'
                      : 'border border-border bg-app text-ink-secondary'
                  )}
                  aria-hidden
                >
                  {badge}
                </span>
                <span className="w-[7.5rem] shrink-0 text-[17px] font-semibold text-ink">
                  {label}
                </span>
                <MenuSelect
                  value={value}
                  allowEmpty
                  emptyLabel="Nincs"
                  placeholder="Válassz típust"
                  className="min-w-0 flex-1"
                  triggerClassName="h-14 border-2 text-[16px] font-medium"
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
      </aside>

      <section className="flex min-h-[360px] min-w-0 flex-1 flex-col bg-app px-6 py-5 md:px-10 lg:h-full lg:py-6">
        <KioskMachiningPreview
          grainMm={grainMm}
          crossMm={crossMm}
          swatch={sheet.swatch}
          imageUrl={sheet.imageUrl}
          grainDirection={sheet.grainDirection}
          quantity={draft.quantity}
          machining={draft.machining}
          edgeIds={draft.edgeIds}
          fillStage
          caption={summary === 'Nincs él' ? '' : summary}
        />
      </section>
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
  onAskDeleteLine,
  onAskDeleteGroup,
  onAskClearCart,
  onAddSame,
  onRecolorMove,
  onRecolorCopy,
  onAddMore,
  onRunPrice,
  canEnterPrimary,
  onEnterPrimary
}: {
  cart: KioskCartLine[]
  sheets: KioskSheet[]
  priceStatus: PriceStatus
  priceError: string | null
  pricedMaterials: KioskPriceMaterialExplain[] | null
  onEdit: (l: KioskCartLine) => void
  onAskDeleteLine: (id: string) => void
  onAskDeleteGroup: (sheetId: string) => void
  onAskClearCart: () => void
  onAddSame: (sheetId: string) => void
  onRecolorMove: (sheetId: string) => void
  onRecolorCopy: (sheetId: string) => void
  onAddMore: () => void
  onRunPrice: () => void
  canEnterPrimary: boolean
  onEnterPrimary: () => void
}) {
  useKioskEnterContinue(canEnterPrimary, onEnterPrimary)
  const [explainMaterialId, setExplainMaterialId] = useState<string | null>(
    null
  )
  const [selectedLineId, setSelectedLineId] = useState<string | null>(
    cart[0]?.id ?? null
  )

  useEffect(() => {
    if (cart.length === 0) {
      setSelectedLineId(null)
      return
    }
    if (!selectedLineId || !cart.some((l) => l.id === selectedLineId)) {
      setSelectedLineId(cart[0]?.id ?? null)
    }
  }, [cart, selectedLineId])

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
  const selectedLine =
    cart.find((l) => l.id === selectedLineId) ?? cart[0] ?? null
  const selectedSheet = selectedLine
    ? sheets.find((s) => s.id === selectedLine.sheetId)
    : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-border bg-surface px-5 py-6 md:px-6 lg:h-full lg:w-[400px] lg:border-b-0 lg:border-r lg:py-7">
        <div className="space-y-1">
          <h1 className="text-[36px] font-semibold leading-tight tracking-tight text-ink lg:text-[40px]">
            Nézd át a rendelésed
          </h1>
          {cart.length > 0 ? (
            <p className="text-[18px] tabular-nums text-ink-secondary">
              {cart.length} panel · {totalPieces} db · {groups.length} anyag
            </p>
          ) : (
            <p className="text-[18px] text-ink-secondary">A kosár üres.</p>
          )}
        </div>

        {cart.length > 0 ? (
          <CartPriceStatusCard
            priceStatus={priceStatus}
            priceError={priceError}
            onRunPrice={onRunPrice}
          />
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="h-14 w-full justify-start text-[18px] font-semibold"
          onClick={onAddMore}
        >
          + Másik anyag
        </Button>

        {cart.length > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-app px-4 py-3.5">
            <Clock
              className="mt-0.5 size-5 shrink-0 text-ink-secondary"
              aria-hidden
            />
            <div className="space-y-1 text-[16px] leading-snug text-ink-secondary">
              <p className="font-semibold text-ink">Mikor lesz kész?</p>
              {hasOrderSheet ? (
                <p>
                  Rendelésre lapot is választottál. Ezt be kell szereznünk,
                  ezért több idő, mire elkészül. A pultnál megmondjuk, mikorra
                  várható.
                </p>
              ) : (
                <p>A pultnál megmondjuk, mikorra várható.</p>
              )}
              <p>Ha elkészült, SMS-ben szólunk.</p>
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-2">
          {cart.length > 0 ? (
            <Button
              type="button"
              variant="danger"
              className="h-12 w-full gap-1.5 text-[16px]"
              onClick={onAskClearCart}
            >
              <Trash2 className="size-4" aria-hidden />
              Kosár ürítése
            </Button>
          ) : null}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-[1.15] flex-col overflow-y-auto bg-app px-5 py-6 lg:h-full lg:border-r lg:border-border lg:px-6 lg:py-7">
        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <p className="text-[20px] font-semibold text-ink">A kosár üres</p>
            <p className="mt-1 max-w-sm text-[16px] text-ink-secondary">
              Válassz lapot a bal oldali „+ Másik anyag” gombbal.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-6">
            {groups.map((group) => {
              const s = group.sheet
              const groupPieces = group.rows.reduce(
                (n, r) => n + r.quantity,
                0
              )
              const matExplain = pricedMaterials?.find(
                (m) => m.materialId === group.sheetId
              )
              const groupGross =
                priceStatus === 'ok' && matExplain
                  ? matExplain.totalGross
                  : null
              const hasExplainForGroup = canExplain && Boolean(matExplain)
              const fill = s
                ? sheetFillStyle(s)
                : { background: 'var(--color-subtle)' }

              return (
                <div
                  key={group.sheetId}
                  className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
                >
                  <div className="space-y-3 border-b-2 border-border border-l-[3px] border-l-primary bg-surface px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="size-12 shrink-0 rounded-lg border border-border"
                        style={fill}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[20px] font-semibold leading-snug text-ink">
                          {s?.name ?? 'Lap'}
                          {s ? `, ${s.thicknessMm} mm` : ''}
                        </p>
                        <p className="text-[16px] tabular-nums text-ink-secondary">
                          {group.rows.length} panel · {groupPieces} db
                        </p>
                      </div>
                      {groupGross != null ? (
                        <p className="rounded-md bg-success-soft px-3 py-1.5 text-[28px] font-semibold tabular-nums text-success-ink">
                          {formatHuf(groupGross)}
                        </p>
                      ) : (
                        <p className="text-[16px] text-ink-secondary">
                          Ár után látszik
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {hasExplainForGroup ? (
                        <button
                          type="button"
                          className="mr-auto text-left text-[16px] font-medium text-ink underline-offset-2 hover:underline"
                          aria-label={`Hogyan jött ki az ár: ${s?.name ?? 'lap'}`}
                          onClick={() => setExplainMaterialId(group.sheetId)}
                        >
                          Hogyan jött ki ez az ár?
                        </button>
                      ) : (
                        <span className="mr-auto" />
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 shrink-0 text-[15px]"
                        onClick={() => onAddSame(group.sheetId)}
                      >
                        + Ugyanebből még
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 shrink-0 text-[15px]"
                        onClick={() => onRecolorMove(group.sheetId)}
                      >
                        <Replace className="size-4" aria-hidden />
                        Dekor csere
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 shrink-0 text-[15px]"
                        onClick={() => onRecolorCopy(group.sheetId)}
                      >
                        <Copy className="size-4" aria-hidden />
                        Másolás
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="h-11 shrink-0 gap-1.5 text-[15px]"
                        onClick={() => onAskDeleteGroup(group.sheetId)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Szín törlése
                      </Button>
                    </div>
                  </div>

                  {priceStatus === 'ok' &&
                  matExplain &&
                  matExplain.fullBoardCount > 0 ? (
                    <p className="flex items-start gap-2 border-b border-border px-4 py-2.5 text-[16px] text-ink">
                      <PackageCheck
                        className="mt-0.5 size-5 shrink-0 text-success-ink"
                        aria-hidden
                      />
                      {LEFTOVER_COPY.cart}
                    </p>
                  ) : null}

                  <ul className="space-y-2 p-3">
                    {group.rows.map((line) => {
                      const chips = machiningSummaryChips(line.machining)
                      const edgeChips = edgeCartChips(line.edgeIds)
                      const label = line.label?.trim()
                      const selected = selectedLine?.id === line.id
                      return (
                        <li key={line.id}>
                          <div
                            className={cn(
                              'flex items-center gap-3 rounded-lg border-2 bg-surface py-3.5 pl-3 pr-3 transition-colors',
                              selected
                                ? 'border-ink border-l-[6px]'
                                : 'border-transparent hover:border-border-strong'
                            )}
                          >
                            <button
                              type="button"
                              aria-pressed={selected}
                              className="flex min-w-0 flex-1 items-center gap-4 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                              onClick={() => setSelectedLineId(line.id)}
                              onDoubleClick={() => onEdit(line)}
                            >
                              <CartPanelThumb
                                grainMm={line.grainMm}
                                crossMm={line.crossMm}
                                machining={line.machining}
                                fillStyle={fill}
                                grainDirection={Boolean(s?.grainDirection)}
                              />
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                  {label ? (
                                    <p className="line-clamp-2 text-[20px] font-semibold text-ink">
                                      {label}
                                    </p>
                                  ) : null}
                                  <p className="text-[20px] font-semibold tabular-nums text-ink">
                                    {line.grainMm} × {line.crossMm}
                                    <span className="ml-1 text-[16px] font-normal text-ink-secondary">
                                      mm
                                    </span>
                                  </p>
                                  <p className="text-[18px] tabular-nums text-ink-secondary">
                                    {line.quantity} db
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {chips.length > 0 ? (
                                    chips.map((chip) => (
                                      <span
                                        key={chip}
                                        className="whitespace-nowrap rounded bg-ink px-2 py-0.5 text-[16px] font-medium text-white"
                                      >
                                        {chip}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[16px] text-ink-secondary">
                                      Nincs megmunkálás
                                    </span>
                                  )}
                                  {edgeChips.length > 0 ? (
                                    edgeChips.map((c) => (
                                      <span
                                        key={c.key}
                                        className="inline-flex max-w-[14rem] items-center gap-1 whitespace-nowrap rounded border border-border bg-white px-2 py-0.5 text-[16px] text-ink"
                                        title={`${c.badge} · ${c.name}`}
                                      >
                                        <span className="font-semibold">
                                          {c.badge}
                                        </span>
                                        <span className="truncate text-ink-secondary">
                                          {c.name}
                                        </span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[16px] text-ink-secondary">
                                      Él nélkül
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-2">
                              {selected ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1.5 text-[15px] font-semibold text-white">
                                  <Eye className="size-4" aria-hidden />
                                  Rajzon
                                </span>
                              ) : null}
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-12 gap-1.5 text-[16px]"
                                onClick={() => onEdit(line)}
                              >
                                <Pencil className="size-4" aria-hidden />
                                Módosítás
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="size-12 p-0 text-danger-ink hover:text-danger-ink"
                                aria-label="Tétel törlése"
                                onClick={() => onAskDeleteLine(line.id)}
                              >
                                <Trash2 className="size-5" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {cart.length > 0 ? (
        <section className="flex min-h-[320px] min-w-0 flex-1 flex-col bg-app px-5 py-6 lg:h-full lg:px-6 lg:py-7">
          {selectedLine && selectedSheet ? (
            <>
              <div className="mb-3 space-y-0.5">
                <p className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-ink-secondary">
                  <Eye className="size-4" aria-hidden />
                  A kijelölt sor rajza
                </p>
                <p className="line-clamp-2 text-[20px] font-semibold text-ink">
                  {selectedSheet.name}, {selectedSheet.thicknessMm} mm
                </p>
                <p className="text-[18px] tabular-nums text-ink-secondary">
                  {selectedLine.label?.trim()
                    ? `${selectedLine.label.trim()} · `
                    : ''}
                  {selectedLine.grainMm} × {selectedLine.crossMm} mm ·{' '}
                  {selectedLine.quantity} db
                </p>
              </div>
              <KioskMachiningPreview
                grainMm={selectedLine.grainMm}
                crossMm={selectedLine.crossMm}
                swatch={selectedSheet.swatch}
                imageUrl={selectedSheet.imageUrl}
                grainDirection={selectedSheet.grainDirection}
                quantity={selectedLine.quantity}
                machining={selectedLine.machining}
                edgeIds={selectedLine.edgeIds}
                fillStage
                caption={
                  edgeSummaryLabel(selectedLine.edgeIds) === 'Nincs él'
                    ? ''
                    : edgeSummaryLabel(selectedLine.edgeIds)
                }
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 text-center text-[18px] text-ink-secondary">
              Válassz egy sort a listából.
            </div>
          )}
        </section>
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

function CartPriceStatusCard({
  priceStatus,
  priceError,
  onRunPrice
}: {
  priceStatus: PriceStatus
  priceError: string | null
  onRunPrice: () => void
}) {
  if (priceStatus === 'ok') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success-soft bg-success-soft/50 px-4 py-3.5">
        <Check
          className="mt-0.5 size-5 shrink-0 text-success-ink"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-success-ink">
            Ár kiszámolva
          </p>
          <p className="mt-0.5 text-[16px] text-ink-secondary">
            A végösszeg a láblécben látszik.
          </p>
        </div>
      </div>
    )
  }

  if (priceStatus === 'loading') {
    return (
      <div className="rounded-xl border border-border bg-app px-4 py-3.5">
        <p className="text-[16px] font-semibold text-ink">Ár számolása…</p>
        <p className="mt-0.5 text-[16px] text-ink-secondary">
          Egy pillanat, amíg az optimalizálás lefut.
        </p>
      </div>
    )
  }

  if (priceStatus === 'error') {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-danger-soft bg-danger-soft/40 px-4 py-3.5">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-danger-ink"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[15px] font-medium text-danger-ink">
            {priceError ?? 'Nem sikerült az árat kiszámolni.'}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="h-10 text-[14px]"
            onClick={onRunPrice}
          >
            Újra
          </Button>
        </div>
      </div>
    )
  }

  if (priceStatus === 'stale') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3.5">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-warning-ink"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-ink">
            A kosár változott
          </p>
          <p className="mt-0.5 text-[16px] text-ink-secondary">
            Számold újra az árat a lábléc gombjával.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-app px-4 py-3.5">
      <p className="text-[16px] font-semibold text-ink">Még nincs ár</p>
      <p className="mt-0.5 text-[16px] text-ink-secondary">
        Nyomd az „Ár kiszámítása” gombot a láblécben.
      </p>
    </div>
  )
}
