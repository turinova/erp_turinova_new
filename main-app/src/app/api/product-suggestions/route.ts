import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // List only pending and without accessory_id
    const { data, error } = await supabaseServer
      .from('product_suggestions')
      .select(`
        id,
        created_at,
        raw_product_name,
        raw_sku,
        raw_base_price,
        raw_multiplier,
        raw_units_id,
        raw_partner_id,
        raw_vat_id,
        raw_currency_id,
        units:raw_units_id(name, shortform),
        partners:raw_partner_id(name),
        vat:raw_vat_id(kulcs)
      `)
      .eq('status', 'pending')
      .is('accessory_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error listing product suggestions:', error)
      return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
    }

    const suggestions = (data || []).map(row => ({
      id: row.id,
      created_at: row.created_at,
      raw_product_name: row.raw_product_name,
      raw_sku: row.raw_sku,
      raw_base_price: row.raw_base_price,
      raw_multiplier: row.raw_multiplier,
      raw_units_id: row.raw_units_id,
      raw_partner_id: row.raw_partner_id,
      raw_vat_id: row.raw_vat_id,
      raw_currency_id: row.raw_currency_id,
      unit_name: (row as any).units?.name || null,
      unit_shortform: (row as any).units?.shortform || null,
      partner_name: (row as any).partners?.name || null,
      vat_percent: (row as any).vat?.kulcs ?? null
    }))

    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


