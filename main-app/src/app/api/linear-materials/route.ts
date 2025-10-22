import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - List all linear materials
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseServer
      .from('linear_materials')
      .select(`
        id,
        brand_id,
        name,
        width,
        length,
        thickness,
        type,
        image_url,
        base_price,
        multiplier,
        price_per_m,
        currency_id,
        vat_id,
        partners_id,
        units_id,
        on_stock,
        active,
        created_at,
        updated_at,
        brands (name),
        currencies (name),
        vat (name, kulcs),
        partners (name),
        units (name, shortform)
      `)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching linear materials:', error)
      return NextResponse.json({ error: 'Failed to fetch linear materials' }, { status: 500 })
    }

    // Fetch machine codes
    const linearMaterialIds = data?.map(lm => lm.id) || []
    const { data: machineCodes } = await supabaseServer
      .from('machine_linear_material_map')
      .select('linear_material_id, machine_code')
      .in('linear_material_id', linearMaterialIds)
      .eq('machine_type', 'Korpus')

    const machineCodeMap = new Map(
      machineCodes?.map(mc => [mc.linear_material_id, mc.machine_code]) || []
    )

    const transformed = data?.map((lm: any) => ({
      ...lm,
      machine_code: machineCodeMap.get(lm.id) || '',
      brand_name: lm.brands?.name || '',
      currency_code: lm.currencies?.name || '',
      partner_name: lm.partners?.name || null,
      unit_name: lm.units?.name || null,
      unit_shortform: lm.units?.shortform || null,
      vat_percent: lm.vat?.kulcs || 0
    })) || []

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new linear material
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Creating linear material:', body)

    const newLinearMaterial = {
      brand_id: body.brand_id,
      name: body.name || '',
      width: parseFloat(body.width) || 0,
      length: parseFloat(body.length) || 0,
      thickness: parseFloat(body.thickness) || 0,
      type: body.type || '',
      image_url: body.image_url || null,
      base_price: parseFloat(body.base_price) || 0,
      multiplier: parseFloat(body.multiplier) || 1.38,
      partners_id: body.partners_id || null,
      units_id: body.units_id || null,
      currency_id: body.currency_id,
      vat_id: body.vat_id,
      on_stock: body.on_stock !== undefined ? body.on_stock : true,
      active: body.active !== undefined ? body.active : true,
    }

    const { data, error } = await supabaseServer
      .from('linear_materials')
      .insert([newLinearMaterial])
      .select()
      .single()

    if (error) {
      console.error('Error creating linear material:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Insert machine code
    if (body.machine_code) {
      await supabaseServer
        .from('machine_linear_material_map')
        .insert({
          linear_material_id: data.id,
          machine_type: 'Korpus',
          machine_code: body.machine_code
        })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

