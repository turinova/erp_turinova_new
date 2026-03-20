/**
 * Merge fields for order status customer e-mails.
 * `order_items_table` is server-generated HTML (whitelist in render — not HTML-escaped).
 */

import { buildSampleOrderItemsTableHtml, formatOrderMoney } from '@/lib/order-status-notification-items-table'

/** Placeholders that expand to trusted server-built HTML (body only; stripped from subject). */
export const ORDER_STATUS_RAW_HTML_MERGE_KEYS = new Set(['order_items_table'])

export type MergeFieldDef = {
  key: string
  label: string
  /** If true, hide from subject-line inserts (table has no place in subject). */
  bodyOnly?: boolean
}

export type MergeFieldGroup = {
  id: string
  title: string
  hint?: string
  fields: MergeFieldDef[]
}

/** Grouped for Notion/Figma-style UI (single source of truth). */
export const ORDER_STATUS_MERGE_GROUPS: MergeFieldGroup[] = [
  {
    id: 'customer',
    title: 'Vevő',
    hint: 'Személyes megszólítás és elérhetőség',
    fields: [
      { key: 'customer_firstname', label: 'Keresztnév' },
      { key: 'customer_lastname', label: 'Vezetéknév' },
      { key: 'customer_email', label: 'E-mail' }
    ]
  },
  {
    id: 'order',
    title: 'Rendelés',
    hint: 'Azonosító és összeg',
    fields: [
      { key: 'order_number', label: 'Rendelésszám' },
      { key: 'status_label', label: 'Státusz (magyar)' },
      { key: 'order_total_gross', label: 'Bruttó végösszeg' },
      { key: 'currency_code', label: 'Pénznem' },
      { key: 'payment_method_name', label: 'Fizetési mód' }
    ]
  },
  {
    id: 'shipping',
    title: 'Szállítás',
    hint: 'Kézbesítés',
    fields: [
      { key: 'shipping_carrier', label: 'Futárszolgálat' },
      { key: 'shipping_method_name', label: 'Szállítási mód' },
      { key: 'tracking_number', label: 'Követési szám' }
    ]
  },
  {
    id: 'shop',
    title: 'Üzlet',
    fields: [{ key: 'shop_name', label: 'Üzlet / feladó neve' }]
  },
  {
    id: 'items',
    title: 'Tételek',
    hint: 'Egy helyen: kép, név, cikkszám, mennyiség, sorösszegek és lábléc a bruttó végösszeggel.',
    fields: [
      {
        key: 'order_items_table',
        label: 'Tételek táblázata',
        bodyOnly: true
      }
    ]
  }
]

/** Flat list (API / tooling). */
export const ORDER_STATUS_NOTIFICATION_MERGE_FIELDS: MergeFieldDef[] = ORDER_STATUS_MERGE_GROUPS.flatMap(
  (g) => g.fields
)

export type OrderStatusNotificationMergeKey =
  | 'customer_firstname'
  | 'customer_lastname'
  | 'customer_email'
  | 'order_number'
  | 'status_label'
  | 'shop_name'
  | 'order_total_gross'
  | 'currency_code'
  | 'payment_method_name'
  | 'shipping_carrier'
  | 'shipping_method_name'
  | 'tracking_number'
  | 'order_items_table'

/** Hungarian labels for DB order.status (aligned with docs/ORDER_STATUS_WORKFLOW.md). */
export const ORDER_STATUS_LABEL_HU: Record<string, string> = {
  pending_review: 'Áttekintésre vár',
  new: 'Új',
  picking: 'Begyűjtés',
  picked: 'Kiszedve',
  verifying: 'Ellenőrzés',
  packing: 'Csomagolás',
  awaiting_carrier: 'Futárra vár',
  shipped: 'Átadva / úton',
  ready_for_pickup: 'Személyes átvételre vár',
  delivered: 'Kézbesítve',
  cancelled: 'Törölve',
  refunded: 'Visszatérítve'
}

export function orderStatusLabelHu(status: string): string {
  return ORDER_STATUS_LABEL_HU[status] ?? status
}

export type OrderRowForNotification = {
  id: string
  order_number: string
  status: string
  customer_firstname: string | null
  customer_lastname: string | null
  customer_email: string | null
  shipping_carrier: string | null
  shipping_method_name: string | null
  payment_method_name: string | null
  total_gross: number | string | null
  currency_code: string | null
  tracking_number: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildOrderStatusNotificationContext(
  order: OrderRowForNotification,
  newStatus: string,
  shopDisplayName: string
): Record<string, string> {
  const gross =
    order.total_gross != null && order.total_gross !== ''
      ? Number(order.total_gross)
      : 0
  const safeGross = Number.isFinite(gross) ? gross : 0
  const cur = (order.currency_code || 'HUF').trim()

  return {
    customer_firstname: (order.customer_firstname || '').trim() || 'Vevő',
    customer_lastname: (order.customer_lastname || '').trim(),
    customer_email: (order.customer_email || '').trim(),
    order_number: (order.order_number || '').trim() || String(order.id).slice(0, 8),
    status_label: orderStatusLabelHu(newStatus),
    shop_name: (shopDisplayName || '').trim() || 'Webáruház',
    order_total_gross: formatOrderMoney(safeGross, cur),
    currency_code: cur || 'HUF',
    payment_method_name: (order.payment_method_name || '').trim() || '—',
    shipping_carrier: (order.shipping_carrier || '').trim() || '—',
    shipping_method_name: (order.shipping_method_name || '').trim() || '—',
    tracking_number: (order.tracking_number || '').trim() || '—'
  }
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

function sanitizeSubjectFragment(s: string): string {
  return s.replace(/[\r\n\t]+/g, ' ').trim()
}

export function renderOrderStatusTemplate(
  template: string,
  context: Record<string, string>,
  mode: 'html' | 'subject'
): string {
  const out = template.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const v = context[key]
    if (v === undefined) return ''

    if (ORDER_STATUS_RAW_HTML_MERGE_KEYS.has(key)) {
      if (mode === 'subject') return ''
      return v
    }

    if (mode === 'subject') {
      return sanitizeSubjectFragment(v)
    }
    return escapeHtml(v)
  })
  return mode === 'subject' ? sanitizeSubjectFragment(out).slice(0, 998) : out
}

/** Sample scalar fields + demo items table for test e-mail. */
export function sampleOrderStatusNotificationContext(): Record<string, string> {
  return {
    customer_firstname: 'Péter',
    customer_lastname: 'Minta',
    customer_email: 'pelda@example.com',
    order_number: 'ORD-2025-03-13-001',
    status_label: 'Átadva / úton',
    shop_name: 'Minta Webáruház Kft.',
    order_total_gross: '12 990 Ft',
    currency_code: 'HUF',
    payment_method_name: 'Utánvét',
    shipping_carrier: 'GLS',
    shipping_method_name: 'Házhoz szállítás',
    tracking_number: 'EX123456789HU',
    order_items_table: buildSampleOrderItemsTableHtml()
  }
}
