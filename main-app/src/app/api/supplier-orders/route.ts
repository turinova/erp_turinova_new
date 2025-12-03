import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const partnerId = searchParams.get('partner_id') || ''

    const offset = (page - 1) * limit

    console.log(`[SUPPLIER ORDERS] Fetching page ${page}, limit ${limit}, search: "${search}", status: "${status}", partner: "${partnerId}"`)

    const startTime = performance.now()

    // Build the query with joins to get all related data
    let query = supabaseServer
      .from('shop_order_items')
      .select(`
        id,
        product_name,
        sku,
        quantity,
        base_price,
        multiplier,
        megjegyzes,
        status,
        created_at,
        updated_at,
        order_id,
        units_id,
        partner_id,
        vat_id,
        currency_id,
        product_type,
        accessory_id,
        material_id,
        linear_material_id,
        shop_orders!inner (
          id,
          customer_name,
          order_number
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        ),
        vat (
          id,
          name,
          kulcs
        ),
        accessories:accessory_id(name, sku),
        materials:material_id(name),
        linear_materials:linear_material_id(name)
      `, { count: 'exact' })
      .is('shop_orders.deleted_at', null)

    // Apply filters
    if (search && search.length >= 2) {
      query = query.or(`product_name.ilike.%${search}%,sku.ilike.%${search}%,shop_orders.customer_name.ilike.%${search}%`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const queryTime = performance.now() - startTime

    if (error) {
      console.error('Error fetching shop order items:', error)
      return NextResponse.json({ error: 'Failed to fetch shop order items' }, { status: 500 })
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    // Transform the data to include calculated fields
    const items = data?.map(item => {
      const grossUnitPrice = Math.round((item.base_price || 0) * (item.multiplier || 1) * (1 + (item.vat?.kulcs || 0) / 100))
      
      return {
        id: item.id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        megjegyzes: item.megjegyzes,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        order_id: item.order_id,
        customer_name: item.shop_orders?.customer_name,
        order_number: item.shop_orders?.order_number,
        unit_name: item.units?.name,
        unit_shortform: item.units?.shortform,
        partner_name: item.partners?.name,
        partner_id: item.partner_id,
        vat_name: item.vat?.name,
        vat_percent: item.vat?.kulcs,
        base_price: item.base_price,
        multiplier: item.multiplier,
        gross_unit_price: grossUnitPrice,
        gross_total: Math.round(grossUnitPrice * item.quantity),
        units_id: item.units_id,
        vat_id: item.vat_id,
        currency_id: item.currency_id,
        product_type: item.product_type,
        accessory_id: item.accessory_id,
        material_id: item.material_id,
        linear_material_id: item.linear_material_id,
        accessories: item.accessories || null,
        materials: item.materials || null,
        linear_materials: item.linear_materials || null
      }
    }) || []

    console.log(`[PERF] Shop Order Items Query: ${queryTime.toFixed(2)}ms (Found ${items.length} items)`)
    console.log(`[PERF] Shop Order Items Total: ${queryTime.toFixed(2)}ms (Transformed ${items.length} items)`)

    return NextResponse.json({
      items,
      totalCount,
      totalPages,
      currentPage: page,
      limit
    })

  } catch (error) {
    console.error('Error in supplier orders API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
