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
  customerId: string | null
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
  /** Rendelésfej megjegyzés (customer_special_orders.note). */
  orderNote: string | null
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
  /** Tétel megjegyzés. */
  note: string | null
  createdAt: string
  /** Listára-helyezés blocker üzenetek (Teendő nézet). */
  leadBlockers: string[]
}

export type CsoWaitingCounts = Record<CsoWaitingView, number>

/** Van-e megjeleníthető fej- vagy tétel-megjegyzés. */
export function hasCsoWaitingNote(input: {
  orderNote?: string | null
  note?: string | null
}): boolean {
  return Boolean(input.orderNote?.trim() || input.note?.trim())
}

/**
 * Várólista tooltip szöveg. Hosszú note esetén rövidít + utalás a részletezőre.
 */
export function formatCsoNoteTooltip(input: {
  orderNote?: string | null
  itemNote?: string | null
  maxLen?: number
}): string | null {
  const order = input.orderNote?.trim() || ''
  const item = input.itemNote?.trim() || ''
  if (!order && !item) return null

  const maxLen = input.maxLen ?? 280
  const parts: string[] = []
  if (order && item) {
    parts.push(`Rendelés: ${order}`, `Tétel: ${item}`)
  } else if (order) {
    parts.push(`Rendelés: ${order}`)
  } else {
    parts.push(item)
  }
  let text = parts.join('\n')
  if (text.length > maxLen) {
    text = `${text.slice(0, Math.max(0, maxLen - 24)).trimEnd()}… (teljes a rendelésen)`
  }
  return text
}

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
  /** PO létrehozás (listára kerülés proxy). */
  poCreatedAt: string | null
  /** PO elküldés időpontja. */
  poOrderedAt: string | null
  poQtyOrdered: number | null
  poQtyReceived: number | null
  reservedQty: number | null
  reservedAt: string | null
  note: string | null
  sortOrder: number
}

export type CsoJourneyStep = {
  key: string
  label: string
  at: string | null
  /** true = megtörtént; false = még hátra */
  done: boolean
  hint?: string
}

/** Kompakt rendelés-út a részletezőhöz (nem teljes audit). */
export function buildCsoJourney(input: {
  createdAt: string
  smsSentAt: string | null
  items: Array<{
    status: CsoItemStatus
    poNumber: string | null
    poStatus: CsoPoStatus | null
    poCreatedAt: string | null
    poOrderedAt: string | null
    reservedAt: string | null
  }>
}): CsoJourneyStep[] {
  const active = input.items.filter((i) => i.status !== 'torolve')
  const steps: CsoJourneyStep[] = [
    {
      key: 'created',
      label: 'Felvéve',
      at: input.createdAt,
      done: true
    }
  ]

  const withPo = active.filter((i) => i.poStatus != null || i.poCreatedAt)
  const earliestPoCreated = withPo
    .map((i) => i.poCreatedAt)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null
  const anyOnList = active.some(
    (i) =>
      i.status === 'rendelve' ||
      i.status === 'itt_van' ||
      i.status === 'atadva' ||
      (i.poStatus != null && i.poStatus !== 'cancelled')
  )
  const draftPo = withPo.find(
    (i) => !i.poStatus || i.poStatus === 'draft'
  )
  steps.push({
    key: 'listed',
    label: 'Beszállítói listán',
    at: earliestPoCreated,
    done: anyOnList,
    hint: draftPo?.poNumber
      ? `${draftPo.poNumber} (vázlat)`
      : withPo[0]?.poNumber ?? undefined
  })

  const orderedAts = withPo
    .map((i) => i.poOrderedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
  const anyOrdered = withPo.some(
    (i) =>
      i.poStatus === 'ordered' ||
      i.poStatus === 'partial' ||
      i.poStatus === 'received'
  )
  steps.push({
    key: 'ordered',
    label: 'Elküldve a beszállítónak',
    at: orderedAts[0] ?? null,
    done: anyOrdered
  })

  const readyAts = active
    .filter((i) => i.status === 'itt_van' || i.status === 'atadva')
    .map((i) => i.reservedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
  const anyReady = active.some(
    (i) => i.status === 'itt_van' || i.status === 'atadva'
  )
  steps.push({
    key: 'ready',
    label: 'Átvehető',
    at: readyAts[0] ?? null,
    done: anyReady
  })

  steps.push({
    key: 'sms',
    label: 'SMS az ügyfélnek',
    at: input.smsSentAt,
    done: Boolean(input.smsSentAt)
  })

  const allDone =
    active.length > 0 && active.every((i) => i.status === 'atadva')
  steps.push({
    key: 'handover',
    label: 'Átadva a vevőnek',
    at: null,
    done: allDone
  })

  return steps
}

/** Átadáskor létrejött értékesítés link. */
export type CsoSaleLink = {
  salesOrderId: string
  saleNumber: string
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
  /** Legutóbbi / elsődleges eladás (shortcut). */
  salesOrderId: string | null
  saleNumber: string | null
  /** Összes átadáshoz kötött eladás (részleges átadás). */
  saleLinks: CsoSaleLink[]
}

export type CsoNextAlso = {
  kind: 'lead' | 'blocked'
  count: number
  /** Rövid ige+tárgy a másodlagos sorhoz. */
  label: string
  /** blocked: első hiányos tétel a szerkesztőhöz. */
  focusItemId?: string
}

export type CsoNextStep = {
  title: string
  body: string
  href?: string
  hrefLabel?: string
  /**
   * `sms` legacy a kind unióban — a compute primaryként nem adja;
   * átvehetőnél mindig `handover`, SMS = `suggestSms` secondary.
   */
  kind: 'lead' | 'send_po' | 'receive' | 'sms' | 'handover' | 'done' | 'blocked'
  /** blocked primary: első hiányos tétel. */
  focusItemId?: string
  /**
   * Másodlagos teendő vegyes státusznál (pl. úton + még listázható).
   * Nem primary — a UI secondary gombbal jeleníti meg. SMS nem ide tartozik.
   */
  also?: CsoNextAlso
  /**
   * Átvehető + SMS még nem ment → egy secondary „SMS (opcionális)” gomb
   * az Átadás mellett (akkor is, ha az `also` lead/blocked).
   */
  suggestSms?: boolean
}

type CsoNextStepItem = {
  id: string
  status: CsoItemStatus
  accessoryId: string | null
  supplierId: string | null
  poId: string | null
  poNumber: string | null
  poStatus: CsoPoStatus | null
}

function blockedBody(items: CsoNextStepItem[]): string {
  const noAccessory = items.filter((i) => !i.accessoryId).length
  const noSupplier = items.filter((i) => i.accessoryId && !i.supplierId).length
  if (noAccessory > 0 && noSupplier > 0) {
    return `${items.length} tételnél hiányzik a termék vagy a beszállító — javítsd, utána listára tehető.`
  }
  if (noAccessory > 0) {
    return `${noAccessory} szabad tételhez katalógus termék kell — utána listára tehető.`
  }
  return `${noSupplier || items.length} tételnél hiányzik a beszállító — válassz beszállítót, utána listára tehető.`
}

function buildAlso(
  leadable: CsoNextStepItem[],
  blocked: CsoNextStepItem[]
): CsoNextAlso | undefined {
  // Preferencia: előbb a kész listázás, aztán a hiány pótlása.
  if (leadable.length > 0) {
    return {
      kind: 'lead',
      count: leadable.length,
      label:
        leadable.length === 1
          ? '1 tétel listára tehető'
          : `${leadable.length} tétel listára tehető`
    }
  }
  if (blocked.length > 0) {
    return {
      kind: 'blocked',
      count: blocked.length,
      label:
        blocked.length === 1
          ? '1 tételnél hiányzik adat'
          : `${blocked.length} tételnél hiányzik adat`,
      focusItemId: blocked[0]?.id
    }
  }
  return undefined
}

/** Certainty-first: egy mondat, mit tegyen most a user (+ opcionális másodlagos). */
export function csoComputeNextStep(input: {
  items: CsoNextStepItem[]
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

  const leadable = active.filter(
    (i) => i.status === 'felveve' && i.accessoryId && i.supplierId
  )
  const blocked = active.filter(
    (i) =>
      i.status === 'felveve' && (!i.accessoryId || !i.supplierId)
  )

  const ready = active.filter((i) => i.status === 'itt_van')
  if (ready.length > 0) {
    const needsSms = !input.smsSentAt
    // SMS soha nem kapu: primary = átadás; egy secondary (`suggestSms`).
    // Emellett csak lead/blocked — ne duplázd az SMS CTA-t.
    return {
      kind: 'handover',
      title: 'Következő: átadás a vevőnek',
      body: needsSms
        ? `${ready.length} tétel átvehető. Add át + fizess — SMS csak akkor kell, ha a vevő még nincs itt.`
        : `${ready.length} tétel vár átadásra. Fizetés / előleg a pulton.`,
      also: buildAlso(leadable, blocked),
      suggestSms: needsSms
    }
  }

  const onWay = active.filter((i) => i.status === 'rendelve')
  if (onWay.length > 0) {
    const also = buildAlso(leadable, blocked)
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
          : 'Beszállítói rendelés',
        also
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
          : 'Beszállítói rendelés',
        also
      }
    }
    return {
      kind: 'receive',
      title: 'Következő: bevételezés',
      body: 'Az áru úton van. Beérkezéskor a Beérkezések menüben vedd fel — a kézi „Megérkezett” csak kivétel.',
      also
    }
  }

  if (leadable.length > 0) {
    // Primary lead: blocked mehet also-ként (hiányos sorok ne vesszenek el).
    const also =
      blocked.length > 0
        ? buildAlso([], blocked)
        : undefined
    return {
      kind: 'lead',
      title: 'Következő: tedd beszállítói listára',
      body: `${leadable.length} tétel felvehető. Egy gombbal PO vázlatra kerül — a beszállítónak még nem megy el.`,
      also
    }
  }

  if (blocked.length > 0) {
    return {
      kind: 'blocked',
      title: 'Hiányzik a termék vagy a beszállító',
      body: blockedBody(blocked),
      focusItemId: blocked[0]?.id
    }
  }

  return null
}

/** UI gombfelirat blocked primary CTA-hoz. */
export function csoBlockedCtaLabel(
  items: Array<{
    status: CsoItemStatus
    accessoryId: string | null
    supplierId: string | null
  }>
): string {
  const blocked = items.filter(
    (i) =>
      i.status === 'felveve' && (!i.accessoryId || !i.supplierId)
  )
  if (blocked.length === 0) return 'Tétel javítása'
  const onlySupplier = blocked.every((i) => i.accessoryId && !i.supplierId)
  return onlySupplier ? 'Válassz beszállítót' : 'Tétel javítása'
}
