import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott elem' }, { status: 400 })
    }

    // Fetch suggestions
    const { data: suggestions, error: fetchError } = await supabaseServer
      .from('product_suggestions')
      .select('*')
      .in('id', ids)
      .eq('status', 'pending')
      .is('accessory_id', null)

    if (fetchError) {
      console.error('Fetch suggestions error:', fetchError)
      return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
    }

    let createdCount = 0
    let approvedCount = 0

    for (const s of suggestions || []) {
      // Minimal validation
      if (!s.raw_product_name || !s.raw_base_price || !s.raw_multiplier || !s.raw_vat_id || !s.raw_currency_id || !s.raw_units_id || !s.raw_partner_id) {
        // skip invalid
        continue
      }

      // Create accessory
      const { data: newAcc, error: accErr } = await supabaseServer
        .from('accessories')
        .insert({
          name: s.raw_product_name,
          sku: s.raw_sku || `NEW-${Date.now()}`,
          base_price: s.raw_base_price,
          multiplier: s.raw_multiplier,
          vat_id: s.raw_vat_id,
          currency_id: s.raw_currency_id,
          units_id: s.raw_units_id,
          partners_id: s.raw_partner_id
        })
        .select('id')
        .single()

      if (accErr || !newAcc) {
        console.error('Create accessory error:', accErr)
        continue
      }
      createdCount++

      // Update suggestion to approved
      const { error: updErr } = await supabaseServer
        .from('product_suggestions')
        .update({
          status: 'approved',
          accessory_id: newAcc.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', s.id)

      if (!updErr) approvedCount++
    }

    return NextResponse.json({ created: createdCount, updated: approvedCount })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


