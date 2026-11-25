import type { StatusBadgeTone } from '@/components/patterns/status-badge'

export const MO_ITEM_STATUSES = [
  'nyitott',
  'megrendelve',
  'megerkezett',
  'atadva',
  'torolve'
] as const

export type MoItemStatus = (typeof MO_ITEM_STATUSES)[number]

export const MO_STATUS_LABEL: Record<MoItemStatus, string> = {
  nyitott: 'Nyitott',
  megrendelve: 'Megrendelve',
  megerkezett: 'Átvehető',
  atadva: 'Átadva',
  torolve: 'Törölve'
}

/** Tétel szintű címke (a fejléc „Átvehető”, a tétel „Megjött”). */
export const MO_ITEM_STATUS_LABEL: Record<MoItemStatus, string> = {
  nyitott: 'Nyitott',
  megrendelve: 'Megrendelve',
  megerkezett: 'Megjött',
  atadva: 'Átadva',
  torolve: 'Törölve'
}

export const MO_STATUS_TONE: Record<MoItemStatus, StatusBadgeTone> = {
  nyitott: 'warning',
  megrendelve: 'info',
  megerkezett: 'success',
  atadva: 'neutral',
  torolve: 'danger'
}

/** Várólista nézetek: munka (első három) + archív. */
export const MO_QUEUE_VIEWS = [
  'nyitott',
  'megrendelve',
  'megerkezett',
  'atadva',
  'torolve',
  'mind'
] as const

export type MoQueueView = (typeof MO_QUEUE_VIEWS)[number]

export const MO_QUEUE_VIEW_LABEL: Record<MoQueueView, string> = {
  nyitott: 'Megrendelni',
  megrendelve: 'Úton',
  megerkezett: 'Átvehető',
  atadva: 'Átadva',
  torolve: 'Törölve',
  mind: 'Mind'
}

export const MO_WORK_VIEWS: MoQueueView[] = ['nyitott', 'megrendelve', 'megerkezett']

export function parseMoQueueView(v: string | undefined | null): MoQueueView {
  return (MO_QUEUE_VIEWS as readonly string[]).includes(v ?? '')
    ? (v as MoQueueView)
    : 'nyitott'
}

/** Bulk műveletek: cél státusz → honnan érvényes. */
export const MO_ACTION_FROM: Record<MoItemStatus, MoItemStatus[]> = {
  nyitott: ['megrendelve', 'megerkezett', 'torolve'],
  megrendelve: ['nyitott'],
  megerkezett: ['nyitott', 'megrendelve'],
  atadva: ['megerkezett'],
  torolve: ['nyitott', 'megrendelve', 'megerkezett']
}

export const MO_ACTION_LABEL: Record<MoItemStatus, string> = {
  nyitott: 'Vissza nyitottra',
  megrendelve: 'Megrendelve',
  megerkezett: 'Megjött',
  atadva: 'Átadva',
  torolve: 'Töröl'
}

export function moActionApplicable(
  target: MoItemStatus,
  statuses: MoItemStatus[]
): MoItemStatus[] {
  const from = MO_ACTION_FROM[target]
  return statuses.filter((s) => from.includes(s))
}

/** Következő lépés a fej státusza alapján (fix szabály, nem rejtett logika). */
export function moNextAction(status: MoItemStatus): MoItemStatus | null {
  if (status === 'nyitott') return 'megrendelve'
  if (status === 'megrendelve') return 'megerkezett'
  if (status === 'megerkezett') return 'atadva'
  return null
}

export type MoDepositMethod = 'keszpenz' | 'kartya' | 'atutalas'

export const MO_DEPOSIT_METHOD_LABEL: Record<MoDepositMethod, string> = {
  keszpenz: 'Készpénz',
  kartya: 'Kártya',
  atutalas: 'Átutalás'
}

export type MoListRow = {
  id: string
  orderNumber: string
  customerName: string
  customerMobile: string | null
  status: MoItemStatus
  itemCount: number
  readyCount: number
  totalGross: number
  createdAt: string
}

export type MoItem = {
  id: string
  orderId: string
  name: string
  sku: string | null
  qty: number
  unitShortform: string
  unitPriceGross: number | null
  accessoryId: string | null
  supplierId: string | null
  supplierName: string | null
  note: string | null
  status: MoItemStatus
  orderedAt: string | null
  orderedByLabel: string | null
  arrivedAt: string | null
  arrivedByLabel: string | null
  handedOverAt: string | null
  handedOverByLabel: string | null
  createdAt: string
}

export type MoDeposit = {
  id: string
  amount: number
  method: MoDepositMethod
  kind: 'eloleg' | 'atadas'
  note: string | null
  createdByLabel: string | null
  createdAt: string
  voidedAt: string | null
  voidedByLabel: string | null
}

export type MoEvent = {
  id: string
  kind: 'created' | 'status' | 'sms' | 'deposit' | 'deposit_void' | 'edited' | 'items_added'
  status: MoItemStatus | null
  itemCount: number | null
  detail: string | null
  actorLabel: string | null
  createdAt: string
}

export type MoBilling = {
  name: string
  postalCode: string
  city: string
  street: string
  houseNumber: string
  taxNumber: string
}

export type MoDetail = {
  id: string
  orderNumber: string
  customerId: string | null
  customerName: string
  customerMobile: string | null
  status: MoItemStatus
  promisedDate: string | null
  note: string | null
  smsSentAt: string | null
  createdByLabel: string | null
  createdAt: string
  /** Az ügyfél törzs számlázási adatai (null = nincs kitöltve / nincs ügyfél). */
  billing: MoBilling | null
  items: MoItem[]
  deposits: MoDeposit[]
  events: MoEvent[]
}

export type MoQueueItem = {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  customerMobile: string | null
  name: string
  sku: string | null
  qty: number
  unitShortform: string
  unitPriceGross: number | null
  supplierId: string | null
  supplierName: string | null
  note: string | null
  status: MoItemStatus
  createdAt: string
  statusAt: string
  /** Ki léptette az aktuális állapotba (megrendelte / átvette). */
  statusByLabel: string | null
  orderSmsSentAt: string | null
  /** Megrendelni nézet: ugyanebből a termékből már úton lévő tételek (dupla rendelés ellen). */
  onWay: { qty: number; orderNumber: string }[]
  supplierSku: string | null
  /** Beszállító webshop keresés erre a termékre (URL sablonból). */
  shopUrl: string | null
}

export type MoQueueGroup = {
  /** supplier id vagy '—' (nincs beszállító) */
  key: string
  supplierId: string | null
  supplierName: string
  color: string | null
  phone: string | null
  email: string | null
  /** A teljes nézetben (nem csak ezen az oldalon). */
  count: number
  gross: number
  unpriced: number
  oldestAt: string | null
  items: MoQueueItem[]
}

export type MoQueueSupplierChip = {
  key: string
  supplierId: string | null
  name: string
  color: string | null
  count: number
}

/** „Úton” ennyi nap után késik; „Átvehető” ennyi nap után régóta a polcon. */
export const MO_LATE_DAYS = 7
export const MO_SHELF_DAYS = 14

export type MoSmsCandidate = {
  orderId: string
  orderNumber: string
  customerName: string
  mobile: string | null
  readyCount: number
  totalCount: number
  previewBody: string
  alreadySentAt: string | null
}

export function moLineGross(unitPriceGross: number | null, qty: number): number {
  if (unitPriceGross == null || !Number.isFinite(unitPriceGross)) return 0
  return Math.round(unitPriceGross * qty)
}

export function moDepositTotal(deposits: MoDeposit[]): number {
  return deposits
    .filter((d) => !d.voidedAt)
    .reduce((s, d) => s + Math.round(d.amount), 0)
}
