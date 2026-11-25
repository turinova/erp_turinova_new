export type OrderShareKind = 'cso' | 'quote' | 'manual'

export type OrderStatusTone = 'success' | 'warning' | 'neutral' | 'info'

export type OrderStatusLineItem = {
  id: string
  name: string
  /** Pl. „8 db” vagy „8 db · élzárás”. */
  qtyLabel: string
  /** Bolti cikkszám — a vevő ezzel tud hivatkozni / utánanézni. */
  sku?: string | null
  /** Egységár bruttó (CSO kész tételeknél). */
  unitPriceGross: number | null
  /** Pl. db — egységár címkéhez. */
  unitShort: string | null
  /** Sorösszeg bruttó. */
  amountGross: number | null
}

export type OrderStatusStep = {
  key: string
  label: string
  done: boolean
  current: boolean
}

export type CustomerOrderStatusView = {
  kind: OrderShareKind
  orderNumber: string
  customerFirstName: string
  statusLabel: string
  statusTone: OrderStatusTone
  statusBody: string
  dueNowGross: number | null
  dueHint: string | null
  depositGross: number | null
  /** Pl. „Összesen 11 db” — lapszab panel összeg. */
  summaryLine: string | null
  company: {
    name: string
    logoUrl: string | null
    phone: string | null
    email: string | null
    addressLine: string | null
  }
  readyItems: OrderStatusLineItem[]
  waitingItems: OrderStatusLineItem[]
  steps: OrderStatusStep[]
  updatedAt: string | null
  /** Már átvett tételek (részletekben átadott rendelésnél). */
  handedItems?: OrderStatusLineItem[]
  /** Most fizetendőből levont befizetés (előleg / korábbi befizetés). */
  creditAppliedGross?: number | null
  /** Előlegből a most átvehető után megmaradó rész. */
  creditLeftGross?: number | null
  /** A még úton lévő tételekért később fizetendő (becslés, előleg után). */
  laterGross?: number | null
  /** Van ár nélküli tétel → az összeget átvételkor közlik. */
  priceUnknown?: boolean
  /** „Most nyitva · 17:00-ig” — nyitvatartás nélkül null. */
  openLabel?: string | null
  /** „Ma: 8:00–17:00”. */
  todayHours?: string | null
  /** „december 9.” — eddig tartják a polcon. */
  pickupUntil?: string | null
  /** Google értékelés kérése (docs/55) — null = nem jelenik meg. */
  review?: OrderStatusReview | null
}

export type OrderStatusReview = {
  /** Relatív rövid link (`/g/{kód}?s=status&t={token}`). */
  href: string
  mode: 'first' | 'repeat' | 'primary' | 'thanks'
}
