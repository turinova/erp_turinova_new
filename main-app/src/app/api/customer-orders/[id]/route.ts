import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// PUT /api/customer-orders/[id] - Update customer order
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

    // Update customer_order
    const { error: orderError } = await supabaseServer
      .from('customer_orders')
      .update({
        customer_name: body.customer_data.customer_name || null,
        customer_email: body.customer_data.customer_email || null,
        customer_mobile: body.customer_data.customer_mobile || null,
        billing_name: body.customer_data.billing_name || null,
        billing_country: body.customer_data.billing_country || null,
        billing_city: body.customer_data.billing_city || null,
        billing_postal_code: body.customer_data.billing_postal_code || null,
        billing_street: body.customer_data.billing_street || null,
        billing_house_number: body.customer_data.billing_house_number || null,
        billing_tax_number: body.customer_data.billing_tax_number || null,
        billing_company_reg_number: body.customer_data.billing_company_reg_number || null,
        discount_percentage: body.discount.percentage || 0,
        discount_amount: body.discount.amount || 0,
        subtotal_net: body.summary?.totalNetAfterDiscount || 0,
        total_vat: body.summary?.totalVatAfterDiscount || 0,
        total_gross: body.summary?.totalGrossAfterDiscount || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (orderError) {
      console.error('Error updating customer order:', orderError)
      return NextResponse.json({ error: 'Hiba a rendelés frissítésekor' }, { status: 500 })
    }

    // Update items - only update quantity and unit_price_gross for items with status 'open'
    for (const item of body.items) {
      if (item.deleted) {
        // Soft delete item
        await supabaseServer
          .from('customer_order_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.id)
      } else if (item.id) {
        // Update existing item - only if status is 'open'
        const { data: existingItem } = await supabaseServer
          .from('customer_order_items')
          .select('status')
          .eq('id', item.id)
          .single()

        if (existingItem?.status === 'open') {
          // Recalculate totals
          const quantity = item.quantity || 0
          const unitPriceGross = item.unit_price_gross || 0
          const vatRate = body.vat_rates?.find((v: any) => v.id === item.vat_id)?.kulcs || 0
          const unitPriceNet = unitPriceGross / (1 + vatRate / 100)
          const totalNet = unitPriceNet * quantity
          const totalGross = unitPriceGross * quantity
          const totalVat = totalGross - totalNet

          await supabaseServer
            .from('customer_order_items')
            .update({
              quantity: quantity,
              unit_price_net: Math.round(unitPriceNet),
              unit_price_gross: Math.round(unitPriceGross),
              total_net: Math.round(totalNet),
              total_vat: Math.round(totalVat),
              total_gross: Math.round(totalGross),
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)
        }
      }
    }

    // Check if there are any active (non-deleted) items remaining
    const { data: activeItems, error: itemsCheckError } = await supabaseServer
      .from('customer_order_items')
      .select('id')
      .eq('order_id', id)
      .is('deleted_at', null)
      .eq('item_type', 'product')

    if (itemsCheckError) {
      console.error('Error checking active items:', itemsCheckError)
      // Don't fail the request, just log the error
    } else {
      // If no active items remain, soft-delete the customer_order
      if (!activeItems || activeItems.length === 0) {
        await supabaseServer
          .from('customer_orders')
          .update({ 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .is('deleted_at', null)
        
        console.log(`[CUSTOMER ORDER] Auto-deleted customer_order ${id} - no active items remaining`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in PUT /api/customer-orders/[id]', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

