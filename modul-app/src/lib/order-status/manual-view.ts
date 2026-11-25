import type { CustomerOrderStatusView, OrderStatusLineItem, OrderStatusStep } from '@/lib/order-status/types'

/** Ennyi napig tartjuk a polcon a megjött tételt (= várólista „Régóta a polcon”). */
export const MANUAL_PICKUP_DAYS = 14

export type ManualViewItem = {
  id: string
  name: string
  sku: string | null
  qty: number
  unitShortform: string
  unitPriceGross: number | null
  status: string
  arrivedAt: string | null
}

export type ManualViewDeposit = { amount: number; voided: boolean }

type Group = {
  id: string
  name: string
  unit: string
  price: number | null
  qty: number
  sku: string | null
}

function fmtQty(qty: number): string {
  return qty.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

/** Részszállításnál kettébontott tétel → egy sor (azonos cikkszám/név + egység + ár). */
function groupLines(items: ManualViewItem[], withPrice: boolean): OrderStatusLineItem[] {
  const m = new Map<string, Group>()
  for (const i of items) {
    const key = `${(i.sku?.trim() || i.name.trim()).toLowerCase()}|${i.unitShortform.toLowerCase()}|${i.unitPriceGross ?? ''}`
    const g = m.get(key)
    if (g) g.qty += i.qty
    else m.set(key, { id: i.id, name: i.name, unit: i.unitShortform || 'db', price: i.unitPriceGross, qty: i.qty, sku: i.sku?.trim() || null })
  }
  return [...m.values()].map((g) => ({
    id: g.id,
    name: g.name,
    qtyLabel: `${fmtQty(g.qty)} ${g.unit}`,
    sku: g.sku,
    unitPriceGross: withPrice ? g.price : null,
    unitShort: withPrice && g.price != null ? g.unit : null,
    amountGross: withPrice && g.price != null ? Math.round(g.price * g.qty) : null
  }))
}

function gross(items: ManualViewItem[]): number {
  return items.reduce((s, i) => s + (i.unitPriceGross != null ? Math.round(i.unitPriceGross * i.qty) : 0), 0)
}

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', timeZone: 'Europe/Budapest' }).format(d)
}

export type ManualViewCore = Omit<CustomerOrderStatusView, 'company' | 'orderNumber' | 'customerFirstName' | 'updatedAt'>

/**
 * Kézi rendelés → vevői státusz nézet. Csak publikus adat (nincs beszállító, belső megjegyzés, telefon).
 * Pénz: a befizetések (előleg + átadáskori) először a már átvett tételeket fedezik, a maradék a mostanit,
 * ami még marad, az a később fizetendőből jön le.
 */
export function buildManualOrderView(
  rawItems: ManualViewItem[],
  deposits: ManualViewDeposit[],
  now: Date = new Date()
): ManualViewCore {
  const items = rawItems.filter((i) => i.status !== 'torolve')
  const ready = items.filter((i) => i.status === 'megerkezett')
  const waiting = items.filter((i) => i.status === 'nyitott' || i.status === 'megrendelve')
  const handed = items.filter((i) => i.status === 'atadva')
  const allDone = items.length > 0 && ready.length === 0 && waiting.length === 0

  const paid = deposits.filter((d) => !d.voided).reduce((s, d) => s + d.amount, 0)
  const credit = Math.max(0, paid - gross(handed))
  const readyGross = gross(ready)
  const priceUnknown = ready.some((i) => i.unitPriceGross == null)
  const creditApplied = Math.min(credit, readyGross)
  const creditLeft = Math.max(0, credit - readyGross)
  const waitingGross = gross(waiting)
  const later = waiting.length > 0 && !waiting.some((i) => i.unitPriceGross == null) ? Math.max(0, waitingGross - creditLeft) : null

  let statusLabel = 'Rögzítettük'
  let statusTone: CustomerOrderStatusView['statusTone'] = 'info'
  let statusBody = 'Hamarosan megrendeljük a beszállítótól.'
  if (items.length === 0) {
    statusLabel = 'Lezárva'
    statusTone = 'info'
    statusBody = 'Ennek a rendelésnek nincs nyitott tétele. Kérdés esetén hívj minket.'
  } else if (allDone) {
    statusLabel = 'Átadva'
    statusTone = 'neutral'
    statusBody = ''
  } else if (ready.length > 0 && waiting.length > 0) {
    statusLabel = 'Részben átvehető'
    statusTone = 'warning'
    statusBody = 'Elviheted most a megjött tételeket, vagy megvárhatod a többit — addig a polcon tartjuk.'
  } else if (ready.length > 0) {
    statusLabel = 'Átvehető'
    statusTone = 'success'
    statusBody = handed.length > 0 ? 'A rendelésed többi része is megjött.' : ''
  } else if (waiting.some((i) => i.status === 'megrendelve')) {
    statusLabel = 'Megrendeltük'
    statusBody = 'Megrendeltük a beszállítótól. SMS-ben szólunk, ha megjött.'
  }

  const anyOrdered = items.some((i) => i.status !== 'nyitott')
  const anyArrived = ready.length > 0 || handed.length > 0
  const doneFlags = [true, anyOrdered, anyArrived, allDone]
  const labels = ['Rögzítve', 'Megrendelve', 'Megérkezett', 'Átvéve']
  const currentIdx = doneFlags.findIndex((d) => !d)
  const steps: OrderStatusStep[] = labels.map((label, i) => ({
    key: label,
    label,
    done: doneFlags[i]!,
    current: i === currentIdx
  }))

  const firstArrival = ready
    .map((i) => (i.arrivedAt ? new Date(i.arrivedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0]
  const pickupUntil =
    ready.length > 0
      ? fmtDay(new Date((firstArrival ?? now.getTime()) + MANUAL_PICKUP_DAYS * 24 * 60 * 60 * 1000))
      : null

  const readyItems = groupLines(ready, true)
  return {
    kind: 'manual',
    statusLabel,
    statusTone,
    statusBody,
    dueNowGross: ready.length > 0 && !priceUnknown ? Math.max(0, readyGross - creditApplied) : null,
    dueHint: null,
    depositGross: paid > 0 ? paid : null,
    summaryLine: readyItems.length >= 2 ? `Összesen ${readyItems.length} tétel` : null,
    readyItems,
    waitingItems: groupLines(waiting, false),
    handedItems: allDone ? [] : groupLines(handed, false),
    steps: allDone || items.length === 0 ? [] : steps,
    creditAppliedGross: ready.length > 0 && creditApplied > 0 ? creditApplied : null,
    creditLeftGross: creditLeft > 0 && !allDone ? creditLeft : null,
    laterGross: later && later > 0 ? later : null,
    priceUnknown: ready.length > 0 && priceUnknown,
    pickupUntil
  }
}
