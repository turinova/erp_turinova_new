import type { SupabaseClient } from '@supabase/supabase-js'

import type { SaleInvoiceLine } from '@/lib/invoicing/szamlazz-xml'

export function sumInvoiceLines(lines: SaleInvoiceLine[]) {
  return lines.reduce(
    (acc, l) => {
      acc.net += l.lineNet
      acc.vat += l.lineVat
      acc.gross += l.lineGross
      return acc
    },
    { net: 0, vat: 0, gross: 0 }
  )
}

export async function insertInvoiceLines(
  supabase: SupabaseClient,
  tenantId: string,
  invoiceId: string,
  lines: SaleInvoiceLine[]
): Promise<void> {
  if (lines.length === 0) return
  const rows = lines.map((l, i) => ({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    line_no: i + 1,
    name: l.name,
    quantity: l.quantity,
    unit: l.unit,
    vat_percent: l.vatPercent,
    unit_net: Math.round(l.unitNet * 100) / 100,
    line_net: l.lineNet,
    line_vat: l.lineVat,
    line_gross: l.lineGross
  }))
  const { error } = await supabase.from('invoice_lines').insert(rows)
  if (error) {
    console.error('insertInvoiceLines', error.message)
  }
}
