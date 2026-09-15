import type { SupabaseClient } from '@supabase/supabase-js'

export type QuoteAccessoryRow = {
  id: string
  accessory_id: string | null
  accessory_name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  quantity: number
  unit_id: string | null
  unit_shortform: string
  unit_price_net: number
  tax_rate_percent: number
  vat_amount: number
  gross_price: number
  comment: string | null
}

export async function listQuoteAccessories(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<QuoteAccessoryRow[]> {
  const { data, error } = await supabase
    .from('quote_accessories')
    .select(
      `
      id,
      accessory_id,
      accessory_name,
      sku,
      barcode,
      barcode_internal,
      quantity,
      unit_id,
      unit_shortform,
      unit_price_net,
      tax_rate_percent,
      vat_amount,
      gross_price,
      comment
    `
    )
    .eq('tenant_id', tenantId)
    .eq('quote_id', quoteId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listQuoteAccessories', error.message)
    throw new Error('Nem sikerült betölteni a termékeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    accessory_id: row.accessory_id,
    accessory_name: row.accessory_name,
    sku: row.sku,
    barcode: row.barcode ?? null,
    barcode_internal: row.barcode_internal ?? null,
    quantity: Number(row.quantity),
    unit_id: row.unit_id ?? null,
    unit_shortform: row.unit_shortform || 'db',
    unit_price_net: Number(row.unit_price_net),
    tax_rate_percent: Number(row.tax_rate_percent),
    vat_amount: Number(row.vat_amount),
    gross_price: Number(row.gross_price),
    comment: row.comment
  }))
}
