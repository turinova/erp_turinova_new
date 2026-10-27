import type {
  CustomerOrderStatusView,
  OrderShareKind
} from '@/lib/order-status/types'

export type OrderStatusPreviewCompany = {
  name: string
  logoUrl: string | null
  phone: string | null
  email: string | null
  addressLine: string | null
}

const FALLBACK_COMPANY: OrderStatusPreviewCompany = {
  name: 'Példa Műhely Kft.',
  logoUrl: null,
  phone: '+36 30 123 4567',
  email: 'info@pelda.hu',
  addressLine: '6000 Kecskemét, Példa u. 1.'
}

/** SMS-pillanat demo — CSO részben átvehető. */
export function sampleCsoOrderStatusView(
  company?: Partial<OrderStatusPreviewCompany> | null
): CustomerOrderStatusView {
  const c = { ...FALLBACK_COMPANY, ...company }
  return {
    kind: 'cso',
    orderNumber: 'UR-1042',
    customerFirstName: 'Anna',
    statusLabel: 'Részben átvehető',
    statusTone: 'warning',
    statusBody: '',
    dueNowGross: 12400,
    dueHint: 'Előleg beszámítva',
    depositGross: 5000,
    summaryLine: 'Összesen 2 tétel',
    company: c,
    readyItems: [
      {
        id: '1',
        name: 'Zsanér 110° félig ráfedő, soft-close',
        qtyLabel: '2 db',
        unitPriceGross: 2400,
        unitShort: 'db',
        amountGross: 4800
      },
      {
        id: '2',
        name: 'Fogantyú fekete',
        qtyLabel: '4 db',
        unitPriceGross: 1900,
        unitShort: 'db',
        amountGross: 7600
      }
    ],
    waitingItems: [
      {
        id: '3',
        name: 'Pánt készlet',
        qtyLabel: '1 db',
        unitPriceGross: null,
        unitShort: null,
        amountGross: null
      }
    ],
    steps: [],
    updatedAt: new Date().toISOString()
  }
}

/** SMS-pillanat demo — lapszab kész (panel db · élzárás). */
export function sampleQuoteOrderStatusView(
  company?: Partial<OrderStatusPreviewCompany> | null
): CustomerOrderStatusView {
  const c = { ...FALLBACK_COMPANY, ...company }
  return {
    kind: 'quote',
    orderNumber: 'M-8821',
    customerFirstName: 'Anna',
    statusLabel: 'Kész, átvehető',
    statusTone: 'success',
    statusBody: '',
    dueNowGross: 48500,
    dueHint: null,
    depositGross: null,
    summaryLine: 'Összesen 11 db',
    company: c,
    readyItems: [
      {
        id: '1',
        name: 'Fehér 18 mm',
        qtyLabel: '8 db · élzárás',
        unitPriceGross: null,
        unitShort: null,
        amountGross: null
      },
      {
        id: '2',
        name: 'Antracit 18 mm',
        qtyLabel: '3 db',
        unitPriceGross: null,
        unitShort: null,
        amountGross: null
      }
    ],
    waitingItems: [],
    steps: [],
    updatedAt: new Date().toISOString()
  }
}

export function sampleOrderStatusView(
  kind: OrderShareKind,
  company?: Partial<OrderStatusPreviewCompany> | null
): CustomerOrderStatusView {
  return kind === 'quote'
    ? sampleQuoteOrderStatusView(company)
    : sampleCsoOrderStatusView(company)
}
