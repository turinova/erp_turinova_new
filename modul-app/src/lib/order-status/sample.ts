import { buildManualOrderView, type ManualViewItem } from '@/lib/order-status/manual-view'
import type { CustomerOrderStatusView, OrderShareKind } from '@/lib/order-status/types'

export type OrderStatusPreviewCompany = {
  name: string
  logoUrl: string | null
  phone: string | null
  email: string | null
  addressLine: string | null
  /** A cég valódi nyitvatartásából („Most nyitva · 17:00-ig”); null → nem jelenik meg. */
  openLabel?: string | null
  todayHours?: string | null
}

const FALLBACK_COMPANY: OrderStatusPreviewCompany = {
  name: 'Példa Műhely Kft.',
  logoUrl: null,
  phone: '+36 30 123 4567',
  email: 'info@pelda.hu',
  addressLine: '6000 Kecskemét, Példa u. 1.'
}

export type OrderStatusPreviewStage = 'waiting' | 'partial' | 'ready' | 'done'

export const PREVIEW_STAGE_OPTIONS: { value: OrderStatusPreviewStage; label: string }[] = [
  { value: 'waiting', label: 'Úton' },
  { value: 'partial', label: 'Részben' },
  { value: 'ready', label: 'Átvehető' },
  { value: 'done', label: 'Átadva' }
]

type SampleLine = Omit<ManualViewItem, 'status' | 'arrivedAt'>

/** Melyik minta tétel milyen állapotban van az adott fázisban. */
function itemsForStage(lines: SampleLine[], stage: OrderStatusPreviewStage): ManualViewItem[] {
  const arrivedAt = new Date().toISOString()
  return lines.map((l, i) => {
    const last = i === lines.length - 1
    const status =
      stage === 'done'
        ? 'atadva'
        : stage === 'waiting'
          ? 'megrendelve'
          : stage === 'partial' && last
            ? 'megrendelve'
            : 'megerkezett'
    return { ...l, status, arrivedAt: status === 'megerkezett' ? arrivedAt : null }
  })
}

const MANUAL_LINES: SampleLine[] = [
  { id: '1', name: 'Fiókcsúszó 500 mm, teljes kihúzású', sku: 'FCS500', qty: 4, unitShortform: 'pár', unitPriceGross: 3900 },
  { id: '2', name: 'Csavar 4x16 (100 db)', sku: 'CS416', qty: 2, unitShortform: 'csomag', unitPriceGross: 1200 },
  { id: '3', name: 'Pánt 110° soft-close', sku: 'P110', qty: 6, unitShortform: 'db', unitPriceGross: 1450 }
]

const CSO_LINES: SampleLine[] = [
  { id: '1', name: 'Zsanér 110° félig ráfedő, soft-close', sku: 'Z110', qty: 2, unitShortform: 'db', unitPriceGross: 2400 },
  { id: '2', name: 'Fogantyú fekete', sku: 'FF1', qty: 4, unitShortform: 'db', unitPriceGross: 1900 },
  { id: '3', name: 'Pánt készlet', sku: 'PK1', qty: 1, unitShortform: 'db', unitPriceGross: 6500 }
]

function withCompany(
  core: Omit<CustomerOrderStatusView, 'company' | 'orderNumber' | 'customerFirstName' | 'updatedAt'>,
  orderNumber: string,
  company: OrderStatusPreviewCompany
): CustomerOrderStatusView {
  const { openLabel = null, todayHours = null, ...c } = company
  return {
    ...core,
    orderNumber,
    customerFirstName: 'Anna',
    company: c,
    updatedAt: new Date().toISOString(),
    openLabel,
    todayHours
  }
}

/** Kézi rendelés demo — ugyanaz a számítás, mint élesben. */
export function sampleManualOrderStatusView(
  company?: Partial<OrderStatusPreviewCompany> | null,
  stage: OrderStatusPreviewStage = 'partial'
): CustomerOrderStatusView {
  const core = buildManualOrderView(itemsForStage(MANUAL_LINES, stage), [{ amount: 5000, voided: false }])
  return withCompany(core, 'KR-2026-014', { ...FALLBACK_COMPANY, ...company })
}

/** Ügyfélrendelés demo — ugyanaz a pénz-bontás, lépéssor nélkül (a CSO oldalon nincs). */
export function sampleCsoOrderStatusView(
  company?: Partial<OrderStatusPreviewCompany> | null,
  stage: OrderStatusPreviewStage = 'partial'
): CustomerOrderStatusView {
  const core = buildManualOrderView(itemsForStage(CSO_LINES, stage), [{ amount: 5000, voided: false }])
  const statusLabel = core.statusLabel === 'Megrendeltük' ? 'Úton' : core.statusLabel
  return withCompany(
    { ...core, kind: 'cso', statusLabel, statusBody: '', steps: [], handedItems: [], pickupUntil: null },
    'UR-1042',
    { ...FALLBACK_COMPANY, ...company }
  )
}

/** Lapszab demo — panel db · élzárás; részben nincs, gyártásban → nincs tétel. */
export function sampleQuoteOrderStatusView(
  company?: Partial<OrderStatusPreviewCompany> | null,
  stage: OrderStatusPreviewStage = 'ready'
): CustomerOrderStatusView {
  const done = stage === 'done'
  const ready = stage === 'ready' || stage === 'partial'
  return withCompany(
    {
      kind: 'quote',
      statusLabel: done ? 'Átadva' : ready ? 'Kész, átvehető' : 'Gyártásban',
      statusTone: done ? 'neutral' : ready ? 'success' : 'info',
      statusBody: '',
      dueNowGross: ready ? 48500 : null,
      dueHint: null,
      depositGross: null,
      summaryLine: ready ? 'Összesen 11 db' : null,
      readyItems: ready
        ? [
            { id: '1', name: 'Fehér 18 mm', qtyLabel: '8 db · élzárás', unitPriceGross: null, unitShort: null, amountGross: null },
            { id: '2', name: 'Antracit 18 mm', qtyLabel: '3 db', unitPriceGross: null, unitShort: null, amountGross: null }
          ]
        : [],
      waitingItems: [],
      steps: []
    },
    'M-8821',
    { ...FALLBACK_COMPANY, ...company }
  )
}

export function sampleOrderStatusView(
  kind: OrderShareKind,
  company?: Partial<OrderStatusPreviewCompany> | null,
  options?: { stage?: OrderStatusPreviewStage; reviewEnabled?: boolean }
): CustomerOrderStatusView {
  const stage = options?.stage ?? 'ready'
  const view =
    kind === 'manual'
      ? sampleManualOrderStatusView(company, stage)
      : kind === 'quote'
        ? sampleQuoteOrderStatusView(company, stage)
        : sampleCsoOrderStatusView(company, stage)
  const showReview = options?.reviewEnabled && (view.statusTone === 'success' || view.statusTone === 'neutral')
  return {
    ...view,
    review: showReview ? { href: '#', mode: stage === 'done' ? 'primary' : 'first' } : null
  }
}
