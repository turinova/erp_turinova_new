export type OrderListInvoiceRow = {
  id: string
  related_order_id: string | null
  internal_number: string | null
  provider_invoice_number: string | null
  invoice_type: string | null
  payment_status: string | null
  payment_due_date?: string | null
  created_at: string | null
  is_storno_of_invoice_id: string | null
}

export type OrderBillingPrimaryStatus =
  | 'not_invoiced'
  | 'proforma'
  | 'advance'
  | 'final'
  | 'storno'

export type OrderBillingSecondaryStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'not_payable'
  | null

export type OrderBillingSummary = {
  primaryStatus: OrderBillingPrimaryStatus
  primaryLabel: string
  secondaryStatus: OrderBillingSecondaryStatus
  secondaryLabel: string | null
  primaryInvoiceNumber: string | null
  primaryInternalNumber: string | null
  tooltipLines: string[]
}

function invoiceTypeLabel(value: string | null | undefined): string {
  switch (String(value || '').trim()) {
    case 'dijbekero':
      return 'Díjbekérő'
    case 'elolegszamla':
      return 'Előlegszámla'
    case 'szamla':
      return 'Végszámla'
    case 'sztorno':
      return 'Sztornó'
    default:
      return 'Bizonylat'
  }
}

function paymentStatusSummary(
  value: string | null | undefined
): { status: OrderBillingSecondaryStatus; label: string | null } {
  switch (String(value || '').trim()) {
    case 'fizetve':
    case 'paid':
      return { status: 'paid', label: 'Fizetve' }
    case 'partial':
      return { status: 'partial', label: 'Részben fizetve' }
    case 'nem_lesz_fizetve':
      return { status: 'not_payable', label: 'Nem lesz fizetve' }
    case 'fizetesre_var':
    case 'pending':
      return { status: 'pending', label: 'Fizetésre vár' }
    default:
      return { status: null, label: null }
  }
}

function sortByCreatedDesc<T extends { created_at: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const av = a.created_at ? new Date(a.created_at).getTime() : 0
    const bv = b.created_at ? new Date(b.created_at).getTime() : 0
    return bv - av
  })
}

function pickPrimaryInvoice(rows: OrderListInvoiceRow[]): {
  primaryStatus: OrderBillingPrimaryStatus
  primaryLabel: string
  invoice: OrderListInvoiceRow | null
} {
  const stornoRows = sortByCreatedDesc(rows.filter((r) => r.invoice_type === 'sztorno'))
  if (stornoRows.length > 0) {
    return {
      primaryStatus: 'storno',
      primaryLabel: 'Sztornózva',
      invoice: stornoRows[0]
    }
  }

  const stornoTargets = new Set(
    rows
      .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
      .map((r) => String(r.is_storno_of_invoice_id))
  )

  const activeNonStorno = sortByCreatedDesc(
    rows.filter((r) => r.invoice_type !== 'sztorno' && !stornoTargets.has(r.id))
  )

  const finalInvoice = activeNonStorno.find((r) => r.invoice_type === 'szamla')
  if (finalInvoice) {
    return {
      primaryStatus: 'final',
      primaryLabel: 'Végszámla kiállítva',
      invoice: finalInvoice
    }
  }

  const advanceInvoice = activeNonStorno.find((r) => r.invoice_type === 'elolegszamla')
  if (advanceInvoice) {
    return {
      primaryStatus: 'advance',
      primaryLabel: 'Előlegszámla kiállítva',
      invoice: advanceInvoice
    }
  }

  const proformaInvoice = activeNonStorno.find((r) => r.invoice_type === 'dijbekero')
  if (proformaInvoice) {
    return {
      primaryStatus: 'proforma',
      primaryLabel: 'Díjbekérő kiállítva',
      invoice: proformaInvoice
    }
  }

  return {
    primaryStatus: 'not_invoiced',
    primaryLabel: 'Nincs számlázva',
    invoice: null
  }
}

export function buildOrderBillingSummary(rows: OrderListInvoiceRow[]): OrderBillingSummary {
  const { primaryStatus, primaryLabel, invoice } = pickPrimaryInvoice(rows)
  const { status: secondaryStatus, label: secondaryLabel } = paymentStatusSummary(
    invoice?.payment_status
  )

  const tooltipLines = [primaryLabel]
  if (invoice) {
    tooltipLines.push(`Típus: ${invoiceTypeLabel(invoice.invoice_type)}`)
    if (invoice.provider_invoice_number) {
      tooltipLines.push(`Számlaszám: ${invoice.provider_invoice_number}`)
    }
    if (invoice.internal_number) {
      tooltipLines.push(`Belső azonosító: ${invoice.internal_number}`)
    }
    if (secondaryLabel) {
      tooltipLines.push(`Állapot: ${secondaryLabel}`)
    }
    if (invoice.payment_due_date) {
      tooltipLines.push(`Határidő: ${invoice.payment_due_date}`)
    }
  } else {
    tooltipLines.push('Ehhez a rendeléshez még nincs rögzített díjbekérő vagy számla.')
  }

  return {
    primaryStatus,
    primaryLabel,
    secondaryStatus,
    secondaryLabel,
    primaryInvoiceNumber: invoice?.provider_invoice_number || null,
    primaryInternalNumber: invoice?.internal_number || null,
    tooltipLines
  }
}

export function buildBillingSummaryByOrderId(
  rows: OrderListInvoiceRow[]
): Record<string, OrderBillingSummary> {
  const grouped = new Map<string, OrderListInvoiceRow[]>()
  for (const row of rows) {
    const orderId = row.related_order_id
    if (!orderId) continue
    const bucket = grouped.get(orderId)
    if (bucket) bucket.push(row)
    else grouped.set(orderId, [row])
  }

  const result: Record<string, OrderBillingSummary> = {}
  for (const [orderId, invoices] of grouped.entries()) {
    result[orderId] = buildOrderBillingSummary(invoices)
  }
  return result
}
