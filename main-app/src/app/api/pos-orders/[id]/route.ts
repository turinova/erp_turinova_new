import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/pos-orders/[id] - Get single POS order with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch POS order with worker
    const { data: order, error: orderError } = await supabaseServer
      .from('pos_orders')
      .select(`
        id,
        pos_order_number,
        worker_id,
        customer_id,
        customer_name,
        customer_email,
        customer_mobile,
        billing_name,
        billing_country,
        billing_city,
        billing_postal_code,
        billing_street,
        billing_house_number,
        billing_tax_number,
        billing_company_reg_number,
        discount_percentage,
        discount_amount,
        subtotal_net,
        total_vat,
        total_gross,
        status,
        created_at,
        updated_at,
        workers(nickname, color)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'POS rendelés nem található' }, { status: 404 })
    }

    // Fetch order items (products and fees) with dimensions from related tables
    const { data: items, error: itemsError } = await supabaseServer
      .from('pos_order_items')
      .select(`
        id,
        item_type,
        product_type,
        accessory_id,
        material_id,
        linear_material_id,
        feetype_id,
        product_name,
        sku,
        quantity,
        unit_price_net,
        unit_price_gross,
        vat_id,
        currency_id,
        total_net,
        total_vat,
        total_gross,
        discount_percentage,
        discount_amount,
        created_at,
        updated_at,
        materials:material_id (
          length_mm,
          width_mm,
          thickness_mm
        ),
        linear_materials:linear_material_id (
          length,
          width,
          thickness
        )
      `)
      .eq('pos_order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error fetching POS order items:', itemsError)
      return NextResponse.json({ error: 'Hiba a tételek lekérdezésekor' }, { status: 500 })
    }

    // Transform items: flatten dimensions from related tables
    const transformedItems = (items || []).map((item: any) => {
      const transformed: any = { ...item }
      
      // Flatten dimensions from related tables
      if (item.materials && Array.isArray(item.materials) && item.materials.length > 0) {
        const material = item.materials[0]
        transformed.length_mm = material.length_mm
        transformed.width_mm = material.width_mm
        transformed.thickness_mm = material.thickness_mm
      } else if (item.materials && !Array.isArray(item.materials)) {
        // Single object (not array)
        transformed.length_mm = item.materials.length_mm
        transformed.width_mm = item.materials.width_mm
        transformed.thickness_mm = item.materials.thickness_mm
      }
      
      if (item.linear_materials && Array.isArray(item.linear_materials) && item.linear_materials.length > 0) {
        const linearMaterial = item.linear_materials[0]
        transformed.length = linearMaterial.length
        transformed.width = linearMaterial.width
        transformed.thickness = linearMaterial.thickness
      } else if (item.linear_materials && !Array.isArray(item.linear_materials)) {
        // Single object (not array)
        transformed.length = item.linear_materials.length
        transformed.width = item.linear_materials.width
        transformed.thickness = item.linear_materials.thickness
      }
      
      // Ensure discount fields are numbers (not null/undefined)
      // Convert string values from database to numbers
      const discountPercentage = item.discount_percentage !== null && item.discount_percentage !== undefined 
        ? Number(item.discount_percentage) 
        : 0
      const discountAmount = item.discount_amount !== null && item.discount_amount !== undefined 
        ? Number(item.discount_amount) 
        : 0
      
      // If discount fields are both 0/null but there's a price difference, calculate discount
      const originalSubtotal = (item.unit_price_gross || 0) * (item.quantity || 0)
      const actualTotal = item.total_gross || 0
      const priceDifference = originalSubtotal - actualTotal
      
      // Only calculate discount from price difference if BOTH discount fields are 0/null AND there's a price difference
      if (discountPercentage === 0 && discountAmount === 0 && priceDifference > 0.01 && originalSubtotal > 0) {
        // Calculate discount as amount (per unit)
        transformed.discount_amount = priceDifference / (item.quantity || 1)
        transformed.discount_percentage = 0
      } else {
        // Preserve existing discount values from database
        transformed.discount_percentage = discountPercentage
        transformed.discount_amount = discountAmount
      }
      
      // Remove nested objects
      delete transformed.materials
      delete transformed.linear_materials
      
      return transformed
    })

    // Fetch payments (including soft-deleted)
    const { data: payments, error: paymentsError } = await supabaseServer
      .from('pos_payments')
      .select(`
        id,
        payment_type,
        amount,
        status,
        created_at,
        updated_at,
        deleted_at
      `)
      .eq('pos_order_id', id)
      .order('created_at', { ascending: true })

    if (paymentsError) {
      console.error('Error fetching POS payments:', paymentsError)
      return NextResponse.json({ error: 'Hiba a tranzakciók lekérdezésekor' }, { status: 500 })
    }

    // Calculate total paid and balance (exclude soft-deleted payments)
    const activePayments = payments?.filter(p => !p.deleted_at) || []
    const totalPaid = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const balance = Number(order.total_gross || 0) - totalPaid

    return NextResponse.json({
      order: {
        ...order,
        worker_nickname: order.workers?.nickname || '',
        worker_color: order.workers?.color || '#1976d2'
      },
      items: transformedItems,
      payments: payments || [],
      total_paid: totalPaid,
      balance: balance
    })
  } catch (error) {
    console.error('Error in GET /api/pos-orders/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/pos-orders/[id] - Update POS order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate required fields
    if (!body.customer_data || !body.discount || !body.items) {
      return NextResponse.json({ error: 'Hiányzó kötelező mezők' }, { status: 400 })
    }

    // Call PostgreSQL function for atomic update
    const { data, error } = await supabaseServer.rpc('update_pos_order', {
      p_pos_order_id: id,
      p_customer_data: body.customer_data,
      p_discount: body.discount,
      p_items: body.items
    })

    if (error) {
      console.error('Error updating POS order:', error)
      // Extract user-friendly error message
      const errorMessage = error.message || 'Hiba a rendelés frissítésekor'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in PUT /api/pos-orders/[id]', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

