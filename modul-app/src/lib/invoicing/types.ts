export const SZAMLAZZ_DEFAULT_API_URL = 'https://www.szamlazz.hu/szamla/'

export type InvoiceType = 'szamla' | 'elolegszamla' | 'dijbekero' | 'sztorno'
export type InvoicePaymentStatus = 'pending' | 'fizetve' | 'nem_lesz_fizetve'
export type InvoiceSourceType = 'sale' | 'opti_quote' | 'opti_order'
export type InvoiceIssueKind = 'normal' | 'advance' | 'proforma'
export type InvoicePaymentMethod = 'cash' | 'bank_transfer' | 'card'

export type InvoiceListItem = {
  id: string
  internal_number: string
  provider_invoice_number: string | null
  invoice_type: InvoiceType
  related_source_type: InvoiceSourceType
  related_source_id: string | null
  related_source_number: string | null
  customer_name: string | null
  gross_total: number | null
  payment_status: InvoicePaymentStatus
  payment_due_date: string | null
  created_at: string
  /** Ha ez sztornó: melyik eredetit sztornózza. */
  is_storno_of_invoice_id?: string | null
}

export type InvoiceRow = InvoiceListItem & {
  customer_email: string | null
  fulfillment_date: string | null
  is_storno_of_invoice_id: string | null
  note: string | null
  pdf_url: string | null
}

export type TenantInvoiceSettings = {
  tenant_id: string
  provider: 'szamlazz_hu'
  agent_key: string | null
  api_url: string | null
  default_send_email: boolean
  default_language: string
}

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  szamla: 'Számla',
  elolegszamla: 'Előlegszámla',
  dijbekero: 'Díjbekérő',
  sztorno: 'Sztornó'
}

export const INVOICE_PAYMENT_STATUS_LABEL: Record<InvoicePaymentStatus, string> =
  {
    pending: 'Fizetésre vár',
    fizetve: 'Fizetve',
    nem_lesz_fizetve: 'Nem lesz fizetve'
  }

export function invoiceTypeLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return INVOICE_TYPE_LABEL[code as InvoiceType] ?? code
}

export function invoicePaymentStatusLabel(
  code: string | null | undefined
): string {
  if (!code) return '—'
  return (
    INVOICE_PAYMENT_STATUS_LABEL[code as InvoicePaymentStatus] ?? code
  )
}

export function issueKindToStoredType(kind: InvoiceIssueKind): InvoiceType {
  if (kind === 'advance') return 'elolegszamla'
  if (kind === 'proforma') return 'dijbekero'
  return 'szamla'
}
