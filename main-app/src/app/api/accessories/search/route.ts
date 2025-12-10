import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSearch = searchParams.get('q') || ''
    const search = rawSearch.trim()
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    
    if (!search || search.length < 2) {
      return NextResponse.json({ accessories: [], totalCount: 0, totalPages: 0, currentPage: 1 })
    }

    const offset = (page - 1) * limit
    const sanitizedSearch = search.replace(/"/g, '\\"')
    const orFilter = `name.ilike."%${sanitizedSearch}%",sku.ilike."%${sanitizedSearch}%",barcode.ilike."%${sanitizedSearch}%"`

    // Get total count for search
    const { count } = await supabaseServer
      .from('accessories')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .or(orFilter)

    // Get paginated search results
    const { data, error } = await supabaseServer
      .from('accessories')
      .select(`
        id, 
        name, 
        sku, 
        barcode,
        base_price,
        multiplier,
        net_price, 
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        )
      `)
      .is('deleted_at', null)
      .or(orFilter)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error searching accessories:', error)
      return NextResponse.json({ error: 'Failed to search accessories' }, { status: 500 })
    }

    // Transform data to match the expected format
    const accessories = data?.map(accessory => ({
      id: accessory.id,
      name: accessory.name,
      sku: accessory.sku,
      barcode: accessory.barcode,
      base_price: accessory.base_price,
      multiplier: accessory.multiplier,
      net_price: accessory.net_price,
      created_at: accessory.created_at,
      updated_at: accessory.updated_at,
      vat_id: accessory.vat_id,
      currency_id: accessory.currency_id,
      units_id: accessory.units_id,
      partners_id: accessory.partners_id,
      vat_name: accessory.vat?.name || '',
      vat_percent: accessory.vat?.kulcs || 0,
      currency_name: accessory.currencies?.name || '',
      unit_name: accessory.units?.name || '',
      unit_shortform: accessory.units?.shortform || '',
      partner_name: accessory.partners?.name || '',
      vat_amount: Math.round((accessory.net_price || 0) * (accessory.vat?.kulcs || 0) / 100),
      gross_price: Math.round((accessory.net_price || 0) * (1 + (accessory.vat?.kulcs || 0) / 100))
    })) || []

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      accessories,
      totalCount,
      totalPages,
      currentPage: page
    })

  } catch (error) {
    console.error('Error in accessories search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
