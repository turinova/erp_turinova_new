import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[API SHOP ORDER] Received shop_order_id:', body.shop_order_id)
    console.log('[API SHOP ORDER] shop_order_id type:', typeof body.shop_order_id)
    console.log('[API SHOP ORDER] shop_order_id truthiness:', !!body.shop_order_id)
    
    // Validate required fields
    if (!body.worker_id) {
      return NextResponse.json({ error: 'Dolgozó kiválasztása kötelező!' }, { status: 400 })
    }
    
    if (!body.customer_name) {
      return NextResponse.json({ error: 'Megrendelő neve kötelező!' }, { status: 400 })
    }
    
    if (!body.products || body.products.length === 0) {
      return NextResponse.json({ error: 'Legalább egy termék hozzáadása kötelező!' }, { status: 400 })
    }

    const isUpdate = !!body.shop_order_id
    console.log('[API SHOP ORDER] isUpdate:', isUpdate)
    let orderNumber = null
    let orderId = body.shop_order_id

    if (isUpdate) {
      // Updating existing shop order - get existing order number
      const { data: existingOrder, error: fetchError } = await supabaseServer
        .from('shop_orders')
        .select('order_number')
        .eq('id', body.shop_order_id)
        .single()
      
      if (fetchError || !existingOrder) {
        return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
      }
      
      orderNumber = existingOrder.order_number
      console.log(`[SHOP ORDER] Updating existing order: ${orderNumber}`)
    } else {
      // Generate order number for new order using database function
      const { data: orderNumberData, error: orderNumberError } = await supabaseServer
        .rpc('generate_shop_order_number')
      
      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError)
        return NextResponse.json({ error: 'Hiba a rendelésszám generálásakor' }, { status: 500 })
      }

      orderNumber = orderNumberData
      console.log(`[SHOP ORDER] Creating new order: ${orderNumber}`)
    }

        // Check if customer exists, if not create new customer
        let customerId = null
        if (body.customer_name) {
          const { data: existingCustomer } = await supabaseServer
            .from('customers')
            .select('id')
            .eq('name', body.customer_name)
            .single()

          if (!existingCustomer) {
            // Create new customer - email is required in database
            const customerEmail = body.customer_email || `${body.customer_name.toLowerCase().replace(/\s+/g, '.')}@example.com`
            const { data: newCustomer, error: customerError } = await supabaseServer
              .from('customers')
              .insert({
                name: body.customer_name,
                email: customerEmail,
                mobile: body.customer_mobile || null,
                discount_percent: parseFloat(body.customer_discount) || 0,
                billing_name: body.billing_name || null,
                billing_country: body.billing_country || null,
                billing_city: body.billing_city || null,
                billing_postal_code: body.billing_postal_code || null,
                billing_street: body.billing_street || null,
                billing_house_number: body.billing_house_number || null,
                billing_tax_number: body.billing_tax_number || null,
                billing_company_reg_number: body.billing_company_reg_number || null
              })
              .select('id')
              .single()

            if (customerError) {
              console.error('Error creating customer:', customerError)
              return NextResponse.json({ error: 'Hiba az ügyfél létrehozásakor' }, { status: 500 })
            }
            customerId = newCustomer.id
          } else {
            customerId = existingCustomer.id
          }
        }

    // Set shop_orders.status based on itemStatus parameter
    const orderStatus = body.itemStatus === 'ordered' ? 'ordered' : 'open'
    
    let orderData
    let orderError

    if (isUpdate) {
      // Update existing shop order
      const updateResult = await supabaseServer
        .from('shop_orders')
        .update({
          worker_id: body.worker_id,
          customer_name: body.customer_name,
          customer_email: body.customer_email || null,
          customer_mobile: body.customer_mobile || null,
          customer_discount: parseFloat(body.customer_discount) || 0,
          billing_name: body.billing_name || null,
          billing_country: body.billing_country || null,
          billing_city: body.billing_city || null,
          billing_postal_code: body.billing_postal_code || null,
          billing_street: body.billing_street || null,
          billing_house_number: body.billing_house_number || null,
          billing_tax_number: body.billing_tax_number || null,
          billing_company_reg_number: body.billing_company_reg_number || null,
          status: orderStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.shop_order_id)
        .select('id')
        .single()
      
      orderData = updateResult.data
      orderError = updateResult.error

      // Delete existing items for this order
      if (!orderError) {
        await supabaseServer
          .from('shop_order_items')
          .delete()
          .eq('order_id', body.shop_order_id)
      }
    } else {
      // Create new shop order
      const insertResult = await supabaseServer
        .from('shop_orders')
        .insert({
          order_number: orderNumber,
          worker_id: body.worker_id,
          customer_name: body.customer_name,
          customer_email: body.customer_email || null,
          customer_mobile: body.customer_mobile || null,
          customer_discount: parseFloat(body.customer_discount) || 0,
          billing_name: body.billing_name || null,
          billing_country: body.billing_country || null,
          billing_city: body.billing_city || null,
          billing_postal_code: body.billing_postal_code || null,
          billing_street: body.billing_street || null,
          billing_house_number: body.billing_house_number || null,
          billing_tax_number: body.billing_tax_number || null,
          billing_company_reg_number: body.billing_company_reg_number || null,
          status: orderStatus
        })
        .select('id')
        .single()
      
      orderData = insertResult.data
      orderError = insertResult.error
    }

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json({ error: 'Hiba a rendelés létrehozásakor' }, { status: 500 })
    }

        // Process products - derive product_type and foreign keys; no auto-create in accessories
        const orderItems = []
        for (const product of body.products) {
          const source = (product.source || '').trim()
          let productType: string | null = null
          let accessoryId: string | null = null
          let materialId: string | null = null
          let linearMaterialId: string | null = null

          if (source === 'materials' && product.material_id) {
            productType = 'material'
            materialId = product.material_id
          } else if (source === 'linear_materials' && product.linear_material_id) {
            productType = 'linear_material'
            linearMaterialId = product.linear_material_id
          } else if (source === 'accessories' && product.accessory_id) {
            productType = 'accessory'
            accessoryId = product.accessory_id
          } else {
            // Free-typed or unknown source: default to accessory suggestion, no FK
            productType = product.product_type || 'accessory'
          }

          // Enforce mutual exclusivity: only one FK allowed
          const fkCount =
            (accessoryId ? 1 : 0) +
            (materialId ? 1 : 0) +
            (linearMaterialId ? 1 : 0)
          if (fkCount > 1) {
            return NextResponse.json({ error: 'Csak egy hivatkozás állhat be egyszerre (accessory/material/linear_material).' }, { status: 400 })
          }

          orderItems.push({
            order_id: orderData.id,
            product_name: product.name,
            sku: product.sku || null,
            type: product.type || null,
            base_price: product.base_price,
            multiplier: product.multiplier,
            quantity: product.quantity,
            units_id: product.units_id || null,
            partner_id: product.partners_id || null,
            vat_id: product.vat_id || null,
            currency_id: product.currency_id || null,
            megjegyzes: product.megjegyzes || null,
            status: body.itemStatus || 'open',
            // new typing + FKs
            product_type: productType,
            accessory_id: accessoryId,
            material_id: materialId,
            linear_material_id: linearMaterialId
          })
        }

    const { data: insertedItems, error: itemsError } = await supabaseServer
      .from('shop_order_items')
      .insert(orderItems)
      .select('id, product_name, sku, base_price, multiplier, quantity, units_id, partner_id, vat_id, currency_id, product_type, accessory_id, material_id, linear_material_id')

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      return NextResponse.json({ error: 'Hiba a termékek mentésekor' }, { status: 500 })
    }

    // Create product suggestions for free-typed lines (no FK present)
    const suggestionRows =
      (insertedItems || [])
        .filter(item => !item.accessory_id && !item.material_id && !item.linear_material_id)
        .map(item => ({
          shop_order_item_id: item.id,
          raw_product_name: item.product_name,
          raw_sku: item.sku || null,
          raw_base_price: item.base_price ?? null,
          raw_multiplier: item.multiplier ?? null,
          raw_quantity: item.quantity ?? null,
          raw_units_id: item.units_id ?? null,
          raw_partner_id: item.partner_id ?? null,
          raw_vat_id: item.vat_id ?? null,
          raw_currency_id: item.currency_id ?? null,
          // status defaults to 'pending' in DB
        }))

    if (suggestionRows.length > 0) {
      const { error: suggestionError } = await supabaseServer
        .from('product_suggestions')
        .insert(suggestionRows)

      if (suggestionError) {
        // Do not fail the entire request; log and continue
        console.error('Error creating product suggestions:', suggestionError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      order_number: orderNumber,
      order_id: orderData.id
    })

  } catch (error) {
    console.error('Error in shop order save:', error)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
