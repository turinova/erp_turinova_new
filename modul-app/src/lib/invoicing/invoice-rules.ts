import type { InvoiceIssueKind, InvoiceListItem } from '@/lib/invoicing/types'
import type { SaleDetail } from '@/lib/sales/queries'

/** Sztornó által „megsemmisített” bizonylat ID-k. */
export function stornoTargetIds(invoices: InvoiceListItem[]): Set<string> {
  return new Set(
    invoices
      .filter((i) => i.invoice_type === 'sztorno' && i.is_storno_of_invoice_id)
      .map((i) => i.is_storno_of_invoice_id as string)
  )
}

export function activeDocs(invoices: InvoiceListItem[]) {
  const stornoOf = stornoTargetIds(invoices)
  const hasFinal = invoices.some(
    (i) => i.invoice_type === 'szamla' && !stornoOf.has(i.id)
  )
  const hasProforma = invoices.some(
    (i) => i.invoice_type === 'dijbekero' && !stornoOf.has(i.id)
  )
  const hasAdvance = invoices.some(
    (i) => i.invoice_type === 'elolegszamla' && !stornoOf.has(i.id)
  )
  return { hasFinal, hasProforma, hasAdvance, stornoOf }
}

/** Aktív végszámla mellett a dijbekérő / előleg „felhasználva”. */
export function isInvoiceConsumedByFinal(
  inv: InvoiceListItem,
  invoices: InvoiceListItem[]
): boolean {
  const { hasFinal, stornoOf } = activeDocs(invoices)
  if (!hasFinal) return false
  if (stornoOf.has(inv.id)) return false
  return (
    inv.invoice_type === 'dijbekero' || inv.invoice_type === 'elolegszamla'
  )
}

/**
 * Sztornó szabály:
 * - sztornó típus / már sztornózott → soha
 * - aktív végszámla mellett dijbekérő/előleg → tilt (felhasználva)
 * - kell provider szám
 */
export function canStornoInvoice(
  inv: InvoiceListItem,
  invoices: InvoiceListItem[],
  opts?: {
    canWrite?: boolean
    hasAgentKey?: boolean
    /** false = lista (nem teljes sale context) — szerver ellenőriz */
    requireFullContext?: boolean
  }
): boolean {
  if (opts?.canWrite === false) return false
  if (opts?.hasAgentKey === false) return false
  if (inv.invoice_type === 'sztorno') return false
  if (!inv.provider_invoice_number?.trim()) return false
  const { stornoOf } = activeDocs(invoices)
  if (stornoOf.has(inv.id)) return false
  if (opts?.requireFullContext !== false) {
    if (isInvoiceConsumedByFinal(inv, invoices)) return false
  }
  return true
}

export function resolveInvoiceKindOptions(
  detail: SaleDetail,
  invoices: InvoiceListItem[]
): {
  options: { value: InvoiceIssueKind; label: string }[]
  defaultKind: InvoiceIssueKind
} {
  const { hasFinal, hasProforma } = activeDocs(invoices)
  const paid = detail.payment_status === 'paid'

  if (hasFinal) {
    return { options: [], defaultKind: 'normal' }
  }

  if (hasProforma && paid) {
    return {
      options: [{ value: 'normal', label: 'Végszámla' }],
      defaultKind: 'normal'
    }
  }

  if (hasProforma && !paid) {
    return {
      options: [{ value: 'advance', label: 'Előlegszámla' }],
      defaultKind: 'advance'
    }
  }

  if (paid) {
    return {
      options: [
        { value: 'normal', label: 'Számla' },
        { value: 'advance', label: 'Előlegszámla' },
        { value: 'proforma', label: 'Díjbekérő' }
      ],
      defaultKind: 'normal'
    }
  }

  return {
    options: [
      { value: 'proforma', label: 'Díjbekérő' },
      { value: 'advance', label: 'Előlegszámla' },
      { value: 'normal', label: 'Számla' }
    ],
    defaultKind: 'proforma'
  }
}

/**
 * Lapszabászat: nincs paid/státusz korlát a végszámlán.
 * Default javaslat: unpaid → díjbekérő, paid → számla.
 */
export function resolveQuoteInvoiceKindOptions(
  paymentStatus: string,
  invoices: InvoiceListItem[]
): {
  options: { value: InvoiceIssueKind; label: string }[]
  defaultKind: InvoiceIssueKind
} {
  const { hasFinal, hasProforma } = activeDocs(invoices)
  const paid = paymentStatus === 'paid'

  if (hasFinal) {
    return { options: [], defaultKind: 'normal' }
  }

  if (hasProforma && paid) {
    return {
      options: [
        { value: 'normal', label: 'Végszámla' },
        { value: 'advance', label: 'Előlegszámla' }
      ],
      defaultKind: 'normal'
    }
  }

  if (hasProforma && !paid) {
    return {
      options: [
        { value: 'normal', label: 'Végszámla' },
        { value: 'advance', label: 'Előlegszámla' }
      ],
      defaultKind: 'normal'
    }
  }

  if (paid) {
    return {
      options: [
        { value: 'normal', label: 'Számla' },
        { value: 'advance', label: 'Előlegszámla' },
        { value: 'proforma', label: 'Díjbekérő' }
      ],
      defaultKind: 'normal'
    }
  }

  return {
    options: [
      { value: 'proforma', label: 'Díjbekérő' },
      { value: 'advance', label: 'Előlegszámla' },
      { value: 'normal', label: 'Számla' }
    ],
    defaultKind: 'proforma'
  }
}

/** Díjbekérő / előleg életút a listán. */
export type InvoiceLifecycle = 'pending' | 'consumed' | 'stornod' | null

export type InvoiceListEnrichment = {
  lifecycle: InvoiceLifecycle
  /** Díjbekérő → aktív végszámla száma */
  linkedFinalNumber: string | null
  linkedFinalId: string | null
  /** Számla → aktív díjbekérő száma */
  linkedProformaNumber: string | null
  linkedProformaId: string | null
  /** Sztornó → eredeti száma */
  stornoOfNumber: string | null
  /** Peers ugyanarra a forrásra (storno / canStorno) */
  peers: InvoiceListItem[]
}

function displayNumber(inv: InvoiceListItem): string {
  return inv.provider_invoice_number?.trim() || inv.internal_number || '—'
}

/**
 * Egy sor enrich: peers = ugyanarra related_source-ra tartozó bizonylatok
 * (teljes sale context, nem csak az aktuális oldal).
 */
export function enrichInvoiceRow(
  inv: InvoiceListItem,
  peers: InvoiceListItem[],
  allForStornoLookup: InvoiceListItem[] = peers
): InvoiceListEnrichment {
  const stornoOf = stornoTargetIds(peers)
  const globalStornoOf = stornoTargetIds(allForStornoLookup)

  let lifecycle: InvoiceLifecycle = null
  if (
    inv.invoice_type === 'dijbekero' ||
    inv.invoice_type === 'elolegszamla'
  ) {
    if (globalStornoOf.has(inv.id) || stornoOf.has(inv.id)) {
      lifecycle = 'stornod'
    } else if (isInvoiceConsumedByFinal(inv, peers)) {
      lifecycle = 'consumed'
    } else {
      lifecycle = 'pending'
    }
  } else if (inv.invoice_type === 'szamla' && stornoOf.has(inv.id)) {
    lifecycle = 'stornod'
  }

  let linkedFinalNumber: string | null = null
  let linkedFinalId: string | null = null
  let linkedProformaNumber: string | null = null
  let linkedProformaId: string | null = null
  let stornoOfNumber: string | null = null

  if (
    (inv.invoice_type === 'dijbekero' || inv.invoice_type === 'elolegszamla') &&
    lifecycle === 'consumed'
  ) {
    const final = peers.find(
      (p) => p.invoice_type === 'szamla' && !stornoOf.has(p.id)
    )
    if (final) {
      linkedFinalId = final.id
      linkedFinalNumber = displayNumber(final)
    }
  }

  if (inv.invoice_type === 'szamla' && !stornoOf.has(inv.id)) {
    const proforma = peers.find(
      (p) =>
        (p.invoice_type === 'dijbekero' || p.invoice_type === 'elolegszamla') &&
        !stornoOf.has(p.id)
    )
    if (proforma) {
      linkedProformaId = proforma.id
      linkedProformaNumber = displayNumber(proforma)
    }
  }

  if (inv.invoice_type === 'sztorno' && inv.is_storno_of_invoice_id) {
    const target =
      allForStornoLookup.find((p) => p.id === inv.is_storno_of_invoice_id) ??
      peers.find((p) => p.id === inv.is_storno_of_invoice_id)
    if (target) stornoOfNumber = displayNumber(target)
  }

  return {
    lifecycle,
    linkedFinalNumber,
    linkedFinalId,
    linkedProformaNumber,
    linkedProformaId,
    stornoOfNumber,
    peers
  }
}

export const INVOICE_LIFECYCLE_LABEL: Record<
  Exclude<InvoiceLifecycle, null>,
  string
> = {
  pending: 'Fizetésre vár',
  consumed: 'Lezárva a számlával',
  stornod: 'Sztornózva'
}

export function invoiceLifecycleTone(
  lifecycle: InvoiceLifecycle
): 'warning' | 'neutral' | 'danger' | 'success' {
  if (lifecycle === 'pending') return 'warning'
  if (lifecycle === 'consumed') return 'neutral'
  if (lifecycle === 'stornod') return 'danger'
  return 'neutral'
}

/** Értékesítés lista: egy sor számlázási állapota (aktív bizonylatok). */
export type SaleInvoiceListStatus =
  | 'none'
  | 'proforma'
  | 'advance'
  | 'invoiced'

export const SALE_INVOICE_STATUS_LABEL: Record<SaleInvoiceListStatus, string> =
  {
    none: 'Nincs',
    proforma: 'Díjbekérő',
    advance: 'Előleg',
    invoiced: 'Számlázva'
  }

export function saleInvoiceListStatus(
  invoices: InvoiceListItem[]
): SaleInvoiceListStatus {
  const { hasFinal, hasProforma, hasAdvance } = activeDocs(invoices)
  if (hasFinal) return 'invoiced'
  if (hasProforma) return 'proforma'
  if (hasAdvance) return 'advance'
  return 'none'
}

export function saleInvoiceStatusTone(
  status: SaleInvoiceListStatus
): 'neutral' | 'warning' | 'info' | 'success' {
  if (status === 'invoiced') return 'success'
  if (status === 'proforma') return 'warning'
  if (status === 'advance') return 'info'
  return 'neutral'
}
