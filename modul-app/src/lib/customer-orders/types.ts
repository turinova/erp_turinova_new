export const CSO_ITEM_STATUSES = [
  'felveve',
  'rendelve',
  'itt_van',
  'atadva',
  'torolve'
] as const

export type CsoItemStatus = (typeof CSO_ITEM_STATUSES)[number]

export const CSO_STATUS_LABEL: Record<CsoItemStatus, string> = {
  felveve: 'Felvéve',
  /** PO vázlatban vagy már elküldve — a PO státusz mondja meg a különbséget. */
  rendelve: 'Beszerzés alatt',
  itt_van: 'Átvehető',
  atadva: 'Átadva',
  torolve: 'Törölve'
}

export type CsoPoStatus =
  | 'draft'
  | 'ordered'
  | 'partial'
  | 'received'
  | 'cancelled'

/**
 * Tételsor badge — PO állapotot is beleszövi, hogy ne kelljen fejben tartani
 * a „rendelve ≠ elküldve” különbséget.
 */
export function csoItemProgressLabel(
  status: CsoItemStatus,
  poStatus?: CsoPoStatus | null
): string {
  if (status === 'felveve') return 'Felvéve'
  if (status === 'itt_van') return 'Átvehető'
  if (status === 'atadva') return 'Átadva'
  if (status === 'torolve') return 'Lemondva'
  if (poStatus === 'ordered') return 'Beszállítónál'
  if (poStatus === 'partial') return 'Részben megjött'
  if (poStatus === 'received') return 'Beérkezett'
  if (poStatus === 'cancelled') return 'PO törölve'
  return 'Listán (vázlat)'
}

export function csoStatusTone(
  status: CsoItemStatus
): 'warning' | 'success' | 'info' | 'neutral' | 'danger' {
  if (status === 'felveve') return 'warning'
  if (status === 'rendelve') return 'info'
  if (status === 'itt_van') return 'success'
  if (status === 'atadva') return 'neutral'
  return 'danger'
}

/** PO állapot röviden az ügyfélrendelés UI-n (nem keverendő a CSO „Beszerzés alatt”-tal). */
export function csoPoStatusShort(poStatus: CsoPoStatus | null | undefined): string {
  if (!poStatus || poStatus === 'draft') return 'Vázlat'
  if (poStatus === 'ordered') return 'Elküldve'
  if (poStatus === 'partial') return 'Részben'
  if (poStatus === 'received') return 'Beérkezett'
  return 'Törölve'
}

/** Pl. „PO-12 · Vázlat” / „PO-12 · Elküldve”. */
export function csoPoLinkLabel(
  poNumber: string,
  poStatus: CsoPoStatus | null | undefined
): string {
  return `${poNumber} · ${csoPoStatusShort(poStatus)}`
}

/** „2/5 megjött” — ha van PO-sor mennyiség + beérkezett. */
export function csoPartialArriveHint(input: {
  status: CsoItemStatus
  qty: number
  unitShortform: string
  poQtyOrdered: number | null
  poQtyReceived: number | null
}): string | null {
  if (input.status !== 'rendelve') return null
  const ordered = input.poQtyOrdered
  const received = input.poQtyReceived
  if (ordered == null || received == null || ordered <= 0) return null
  if (received <= 0) return null
  if (received >= ordered) return null
  const unit = input.unitShortform || 'db'
  return `${received}/${ordered} ${unit} megjött — a tétel akkor lesz átvehető, ha a teljes mennyiség megvan`
}

export type CsoItemEditRules = {
  name: boolean
  sku: boolean
  supplier: boolean
  qty: boolean
  price: boolean
  note: boolean
  /** cancel = lemondás; release = foglalás feloldása (áru polcon marad) */
  cancel: 'cancel' | 'release' | null
  restore: boolean
  /** Miért nem szerkeszthető a mennyiség (UI magyarázat). */
  qtyLockedReason: string | null
}

/** Mit enged a tétel adott státuszban — kliens és szerver ugyanezt használja. */
export function csoItemEditRules(
  status: CsoItemStatus,
  poStatus: CsoPoStatus | null
): CsoItemEditRules {
  if (status === 'felveve') {
    return {
      name: true,
      sku: true,
      supplier: true,
      qty: true,
      price: true,
      note: true,
      cancel: 'cancel',
      restore: false,
      qtyLockedReason: null
    }
  }
  if (status === 'rendelve') {
    const poDraft = poStatus === 'draft' || poStatus === null
    return {
      name: false,
      sku: false,
      supplier: false,
      qty: poDraft,
      price: true,
      note: true,
      cancel: 'cancel',
      restore: false,
      qtyLockedReason: poDraft
        ? null
        : 'A beszállítói rendelés már elment — a mennyiség nem módosítható.'
    }
  }
  if (status === 'itt_van') {
    return {
      name: false,
      sku: false,
      supplier: false,
      qty: false,
      price: true,
      note: true,
      cancel: 'release',
      restore: false,
      qtyLockedReason: 'Megérkezett tétel mennyisége nem módosítható.'
    }
  }
  return {
    name: false,
    sku: false,
    supplier: false,
    qty: false,
    price: false,
    note: true,
    cancel: null,
    restore: status === 'torolve',
    qtyLockedReason:
      status === 'atadva' ? 'Átadott tétel.' : 'Lemondott tétel.'
  }
}

export type CustomerSpecialOrderListItem = {
  id: string
  orderNumber: string
  customerName: string
  customerMobile: string
  status: CsoItemStatus
  itemCount: number
  createdAt: string
  promisedDate: string | null
  depositAmount: number | null
  smsSentAt: string | null
  /** Élő tételek a lemondás dialógushoz. */
  cancelLines: Array<{
    id: string
    name: string
    qty: number
    unitShortform: string
    status: CsoItemStatus
    poNumber: string | null
    poStatus: CsoPoStatus | null
  }>
}

/** Teljes rendelés lemondható, ha van élő tétel és egyik sem átadva. */
export function orderCanBeCancelled(status: CsoItemStatus): boolean {
  return (
    status === 'felveve' || status === 'rendelve' || status === 'itt_van'
  )
}

/** Beszállítói várólista URL nézetek. */
export const CSO_WAITING_VIEWS = [
  'todo',
  'on_way',
  'ready',
  'done',
  'cancelled'
] as const

export type CsoWaitingView = (typeof CSO_WAITING_VIEWS)[number]

export const CSO_WAITING_VIEW_LABEL: Record<CsoWaitingView, string> = {
  todo: 'Teendő',
  on_way: 'Beszerzés',
  ready: 'Átvehető',
  done: 'Átadva',
  cancelled: 'Lemondva'
}

/** Átvehető nézet: csak SMS nélküli rendelések. */
export const CSO_NOTIFY_PENDING = 'pending' as const
export type CsoNotifyFilter = typeof CSO_NOTIFY_PENDING | ''

export function waitingViewToStatus(view: CsoWaitingView): CsoItemStatus {
  if (view === 'todo') return 'felveve'
  if (view === 'on_way') return 'rendelve'
  if (view === 'ready') return 'itt_van'
  if (view === 'done') return 'atadva'
  return 'torolve'
}

export type CsoWaitingListItem = {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  customerMobile: string
  depositAmount: number | null
  smsSentAt: string | null
  name: string
  qty: number
  unitShortform: string
  unitPriceGross: number | null
  accessoryId: string | null
  sku: string | null
  supplierId: string | null
  supplierName: string | null
  status: CsoItemStatus
  purchaseOrderItemId: string | null
  poId: string | null
  poNumber: string | null
  poStatus: CsoPoStatus | null
  /** PO sor mennyiség (összevont, ha több CSO → egy PO sor). */
  poQtyOrdered: number | null
  /** PO sorra beérkezett mennyiség (csak received receipt). */
  poQtyReceived: number | null
  note: string | null
  createdAt: string
  /** Listára-helyezés blocker üzenetek (Teendő nézet). */
  leadBlockers: string[]
}

export type CsoWaitingCounts = Record<CsoWaitingView, number>

/** Listára tehető-e a tétel (katalógus + beszállító). */
export function csoItemLeadBlockers(item: {
  accessoryId: string | null
  supplierId: string | null
}): string[] {
  const blockers: string[] = []
  if (!item.accessoryId) blockers.push('Katalógus termék kell')
  if (!item.supplierId) blockers.push('Beszállító kell')
  return blockers
}

export type CustomerSpecialOrderItemRow = {
  id: string
  name: string
  qty: number
  unitShortform: string
  /** Bruttó egységár felvételkor (Ft). */
  unitPriceGross: number | null
  accessoryId: string | null
  sku: string | null
  supplierId: string | null
  supplierName: string | null
  status: CsoItemStatus
  purchaseOrderItemId: string | null
  poId: string | null
  poNumber: string | null
  poStatus: CsoPoStatus | null
  poQtyOrdered: number | null
  poQtyReceived: number | null
  reservedQty: number | null
  reservedAt: string | null
  note: string | null
  sortOrder: number
}

export type CustomerSpecialOrderDetail = {
  id: string
  orderNumber: string
  customerId: string | null
  customerName: string
  customerMobile: string
  status: CsoItemStatus
  depositAmount: number | null
  promisedDate: string | null
  smsSentAt: string | null
  note: string | null
  createdAt: string
  items: CustomerSpecialOrderItemRow[]
}

export type CsoNextStep = {
  title: string
  body: string
  href?: string
  hrefLabel?: string
  kind: 'lead' | 'send_po' | 'receive' | 'sms' | 'handover' | 'done' | 'blocked'
}

/** Certainty-first: egy mondat, mit tegyen most a user. */
export function csoComputeNextStep(input: {
  items: Array<{
    status: CsoItemStatus
    accessoryId: string | null
    supplierId: string | null
    poId: string | null
    poNumber: string | null
    poStatus: CsoPoStatus | null
  }>
  smsSentAt: string | null
}): CsoNextStep | null {
  const active = input.items.filter((i) => i.status !== 'torolve')
  if (active.length === 0) {
    return {
      kind: 'done',
      title: 'Nincs élő tétel',
      body: 'A rendelés le van mondva, vagy minden tétel törölve.'
    }
  }
  if (active.every((i) => i.status === 'atadva')) {
    return {
      kind: 'done',
      title: 'Kész',
      body: 'Minden tétel átadva a vevőnek.'
    }
  }
  const ready = active.filter((i) => i.status === 'itt_van')
  if (ready.length > 0) {
    if (!input.smsSentAt) {
      return {
        kind: 'sms',
        title: 'Következő: SMS az ügyfélnek',
        body: `${ready.length} tétel átvehető. Küldj értesítőt, majd add át a vevőnek.`
      }
    }
    return {
      kind: 'handover',
      title: 'Következő: átadás a vevőnek',
      body: `${ready.length} tétel vár átadásra. Fizetés / előleg levonás a pulton történik.`
    }
  }
  const onWay = active.filter((i) => i.status === 'rendelve')
  if (onWay.length > 0) {
    const draft = onWay.find(
      (i) => i.poId && (!i.poStatus || i.poStatus === 'draft')
    )
    if (draft?.poId) {
      return {
        kind: 'send_po',
        title: 'Következő: küldd el a beszállítói rendelést',
        body: `${draft.poNumber ?? 'PO'} még vázlat — amíg nem küldöd, a beszállító nem kapja meg.`,
        href: `/beszallitoi-rendelesek/${draft.poId}`,
        hrefLabel: draft.poNumber
          ? `Megnyitás: ${draft.poNumber}`
          : 'Beszállítói rendelés'
      }
    }
    const orderedPo = onWay.find((i) => i.poId && i.poStatus === 'ordered')
    if (orderedPo?.poId) {
      return {
        kind: 'receive',
        title: 'Következő: vedd be a Beérkezéseken',
        body: 'Ha megjött az áru, a Beérkezések oldalon vedd fel — így lesz „Átvehető” és a készlet is stimmel.',
        href: `/beszallitoi-rendelesek/${orderedPo.poId}`,
        hrefLabel: orderedPo.poNumber
          ? `PO megnyitás: ${orderedPo.poNumber}`
          : 'Beszállítói rendelés'
      }
    }
    return {
      kind: 'receive',
      title: 'Következő: bevételezés',
      body: 'Az áru úton van. Beérkezéskor a Beérkezések menüben vedd fel — a kézi „Megérkezett” csak kivétel.'
    }
  }
  const leadable = active.filter(
    (i) => i.status === 'felveve' && i.accessoryId && i.supplierId
  )
  if (leadable.length > 0) {
    return {
      kind: 'lead',
      title: 'Következő: tedd beszállítói listára',
      body: `${leadable.length} tétel felvehető. Egy gombbal PO vázlatra kerül — a beszállítónak még nem megy el.`
    }
  }
  const blocked = active.filter((i) => i.status === 'felveve')
  if (blocked.length > 0) {
    return {
      kind: 'blocked',
      title: 'Hiányzik a termék vagy a beszállító',
      body: 'Nyisd meg a tételt, rendelj hozzá katalógus terméket és beszállítót — utána listára tehető.'
    }
  }
  return null
}
