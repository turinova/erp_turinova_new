import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await supabaseServer
      .from('product_suggestions')
      .select(`
        id,
        status,
        admin_note,
        created_at,
        raw_product_name,
        raw_sku,
        raw_base_price,
        raw_multiplier,
        raw_quantity,
        raw_units_id,
        raw_partner_id,
        raw_vat_id,
        raw_currency_id,
        units:raw_units_id(name, shortform),
        partners:raw_partner_id(name),
        vat:raw_vat_id(kulcs),
        currencies:raw_currency_id(name)
      `)
      .eq('id', id)
      .single()
    if (error) {
      return NextResponse.json({ error: 'Javaslat nem található' }, { status: 404 })
    }
    return NextResponse.json({ suggestion: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const update: any = {
      raw_product_name: body.raw_product_name,
      raw_sku: body.raw_sku,
      raw_base_price: body.raw_base_price,
      raw_multiplier: body.raw_multiplier,
      raw_quantity: body.raw_quantity,
      raw_units_id: body.raw_units_id,
      raw_partner_id: body.raw_partner_id,
      raw_vat_id: body.raw_vat_id,
      raw_currency_id: body.raw_currency_id,
      admin_note: body.admin_note
    }

    const { data, error } = await supabaseServer
      .from('product_suggestions')
      .update(update)
      .eq('id', id)
      .eq('status', 'pending')
      .is('accessory_id', null)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: data.id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


