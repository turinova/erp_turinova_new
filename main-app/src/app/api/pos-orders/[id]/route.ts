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

    // Fetch order items (products and fees)
    const { data: items, error: itemsError } = await supabaseServer
      .from('pos_order_items')
      .select(`
        id,
        item_type,
        accessory_id,
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
        created_at,
        updated_at
      `)
      .eq('pos_order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error fetching POS order items:', itemsError)
      return NextResponse.json({ error: 'Hiba a tételek lekérdezésekor' }, { status: 500 })
    }

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
      items: items || [],
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

