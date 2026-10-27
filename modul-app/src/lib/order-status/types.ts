export type OrderShareKind = 'cso' | 'quote'

export type OrderStatusTone = 'success' | 'warning' | 'neutral' | 'info'

export type OrderStatusLineItem = {
  id: string
  name: string
  /** Pl. „8 db” vagy „8 db · élzárás”. */
  qtyLabel: string
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
}
