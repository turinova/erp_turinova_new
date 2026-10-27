export type OrderShareKind = 'cso' | 'quote'

export type OrderStatusTone = 'success' | 'warning' | 'neutral' | 'info'

export type OrderStatusLineItem = {
  id: string
  name: string
  qtyLabel: string
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
