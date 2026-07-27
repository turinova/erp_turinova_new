/** Mentett ügyfélajánlat (studio) — shared types + helpers. */

import type {
  BuyerDraft,
  CustomerFacingPdfPayload,
  ManualLineType,
  PaymentScheduleId,
  PdfPaletteId,
  QuoteSourceType
} from '@/components/muhely-ajanlat/customerFacingPdfShared'

export type PortalPdfRowSnapshot = {
  title: string
  subtitle?: string
  quantityLabel: string
  unitPriceGross: number
  lineTotalGross: number
}

export type CustomerQuoteSnapshot = {
  quoteNumber: string
  createdAt: string
  preparedBy: string
  buyer: {
    name: string
    email: string
    mobile: string
    billing_name: string
    billing_city: string
    billing_postal_code: string
    billing_street: string
    billing_house_number: string
    billing_tax_number: string
  }
  portalSourceRows: PortalPdfRowSnapshot[]
  manualLines: Array<{
    type: string
    title: string
    quantity: number
    unit: string
    unitPriceGross: number
  }>
  payableGross: number
  validUntilDisplay: string
  projectTitle?: string
  paymentText?: string
  leadTimeNote?: string
  customerNotes?: string
  paletteId?: PdfPaletteId
  accentHex?: string
  showVatNote?: boolean
}

/** Stored studio form — logo stripped. */
export type CustomerQuoteStoredPayload = Omit<
  CustomerFacingPdfPayload,
  'workshopLogoDataUrl' | 'generatedFrom'
> & {
  customerQuoteId?: string
}

export type PortalCustomerQuoteListItem = {
  id: string
  quote_number: string
  buyer_name: string
  project_title: string | null
  payable_gross: number
  sources_summary: string
  created_at: string
  updated_at: string
  last_pdf_at: string | null
}

export type PortalCustomerQuoteRecord = PortalCustomerQuoteListItem & {
  payload: CustomerQuoteStoredPayload
  snapshot: CustomerQuoteSnapshot
  portal_customer_id: string
}

export function stripPayloadForStorage(
  payload: CustomerFacingPdfPayload & { customerQuoteId?: string }
): CustomerQuoteStoredPayload {
  const { workshopLogoDataUrl: _logo, generatedFrom: _from, ...rest } = payload
  return {
    ...rest,
    customerQuoteId: payload.customerQuoteId
  }
}

export function buildSourcesSummary(
  portalSources:
    | Array<{ type?: string }>
    | undefined
    | null,
  manualLinesCount: number
): string {
  const types = new Set<string>()
  for (const s of portalSources || []) {
    if (s?.type === 'nettfront') types.add('nettfront')
    else if (s?.type === 'lapszabaszat') types.add('lapszabaszat')
  }
  const parts: string[] = []
  if (types.has('lapszabaszat')) parts.push('Lapszabászat')
  if (types.has('nettfront')) parts.push('Nettfront')
  if (manualLinesCount > 0) parts.push('Plusz tételek')
  return parts.length > 0 ? parts.join(' + ') : 'Manuális'
}

export function sourcesSummaryLabel(summary: string): string {
  return summary || 'Manuális'
}

export function isValidStoredPayload(raw: unknown): raw is CustomerQuoteStoredPayload {
  if (!raw || typeof raw !== 'object') return false
  const p = raw as Record<string, unknown>
  return Boolean(p.buyer && typeof p.buyer === 'object')
}

export function isValidSnapshot(raw: unknown): raw is CustomerQuoteSnapshot {
  if (!raw || typeof raw !== 'object') return false
  const s = raw as Record<string, unknown>
  return (
    typeof s.quoteNumber === 'string' &&
    Array.isArray(s.portalSourceRows) &&
    Array.isArray(s.manualLines) &&
    typeof s.payableGross === 'number'
  )
}

export function portalSourcesFromPayload(
  payload: CustomerQuoteStoredPayload | null | undefined
): Array<{ type: QuoteSourceType; id: string }> {
  const list = payload?.portalSources
  if (!Array.isArray(list)) return []
  const out: Array<{ type: QuoteSourceType; id: string }> = []
  const seen = new Set<string>()
  for (const item of list) {
    const type =
      item?.type === 'nettfront'
        ? 'nettfront'
        : item?.type === 'lapszabaszat'
          ? 'lapszabaszat'
          : null
    const id = String(item?.id || '').trim()
    if (!type || !id) continue
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ type, id })
  }
  return out.slice(0, 8)
}

export function sourcePricingFromPayload(
  payload: CustomerQuoteStoredPayload | null | undefined
): Record<
  string,
  { markupPercent: number; roundTo: 0 | 100 | 1000; lineDisplay: 'collapsed' | 'detailed' }
> {
  const out: Record<
    string,
    { markupPercent: number; roundTo: 0 | 100 | 1000; lineDisplay: 'collapsed' | 'detailed' }
  > = {}
  for (const s of payload?.portalSources || []) {
    const type =
      s.type === 'nettfront' ? 'nettfront' : s.type === 'lapszabaszat' ? 'lapszabaszat' : null
    const id = String(s.id || '').trim()
    if (!type || !id) continue
    const roundToRaw = Number(s.roundTo) || 0
    const roundTo = roundToRaw === 100 || roundToRaw === 1000 ? roundToRaw : 0
    out[`${type}:${id}`] = {
      markupPercent: Math.max(0, Math.min(500, Number(s.markupPercent) || 0)),
      roundTo,
      lineDisplay: s.lineDisplay === 'detailed' ? 'detailed' : 'collapsed'
    }
  }
  return out
}

export function manualLinesFromPayload(
  payload: CustomerQuoteStoredPayload | null | undefined
): Array<{
  type: ManualLineType
  title: string
  quantity: string
  unit: string
  unitPriceGross: string
}> {
  return (payload?.manualLines || []).map(line => ({
    type: (line.type as ManualLineType) || 'other',
    title: String(line.title || ''),
    quantity: String(line.quantity ?? ''),
    unit: String(line.unit || 'db'),
    unitPriceGross: String(line.unitPriceGross ?? '')
  }))
}

export function buyerFromPayload(
  payload: CustomerQuoteStoredPayload | null | undefined
): BuyerDraft | null {
  const b = payload?.buyer
  if (!b) return null
  return {
    name: String(b.name || ''),
    phone: String(b.phone || ''),
    email: String(b.email || ''),
    postalCode: String(b.postalCode || ''),
    city: String(b.city || ''),
    street: String(b.street || ''),
    taxNumber: String(b.taxNumber || '')
  }
}

export function paymentScheduleFromPayload(
  payload: CustomerQuoteStoredPayload | null | undefined
): PaymentScheduleId {
  const raw = payload?.paymentSchedule
  if (raw === '40-40-20' || raw === '50-50' || raw === 'none') return raw
  return '50-50'
}

export function paletteFromPayload(
  payload: CustomerQuoteStoredPayload | null | undefined
): PdfPaletteId {
  const raw = payload?.paletteId
  if (
    raw === 'mono' ||
    raw === 'forest' ||
    raw === 'navy' ||
    raw === 'walnut' ||
    raw === 'slate' ||
    raw === 'custom'
  ) {
    return raw
  }
  return 'mono'
}
