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

        // Process products - only create accessories for actual accessories, not materials
        const orderItems = []
        for (const product of body.products) {
          
          // Check if this is from materials or linear_materials
          const isFromMaterials = product.source === 'materials'
          const isFromLinearMaterials = product.source === 'linear_materials'
          
          // Only create accessory if it's NOT from materials/linear_materials
          if (!isFromMaterials && !isFromLinearMaterials) {
            // Check if this is a new accessory (no SKU, empty SKU, or SKU doesn't exist in database)
            let shouldCreateNewAccessory = false
            
            if (!product.sku || product.sku.trim() === '') {
              shouldCreateNewAccessory = true
            } else {
              // Check if SKU exists in database
              const { data: existingAccessory } = await supabaseServer
                .from('accessories')
                .select('id')
                .eq('sku', product.sku.trim())
                .single()
              
              if (!existingAccessory) {
                shouldCreateNewAccessory = true
              }
            }
            
            if (shouldCreateNewAccessory) {
              // Create new accessory - SKU is required in database
              const generatedSku = product.sku && product.sku.trim() !== '' 
                ? product.sku.trim() 
                : `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
              
              // Get a default partner ID if none provided
              // Ensure empty strings are converted to null
              let partnerId = product.partners_id && product.partners_id.trim() !== '' 
                ? product.partners_id 
                : null
              
              if (!partnerId) {
                const { data: defaultPartner } = await supabaseServer
                  .from('partners')
                  .select('id')
                  .limit(1)
                  .single()
                partnerId = defaultPartner?.id || null
              }
              
              const { data: newAccessory, error: accessoryError } = await supabaseServer
                .from('accessories')
                .insert({
                  name: product.name,
                  sku: generatedSku,
                  base_price: product.base_price,
                  multiplier: product.multiplier,
                  vat_id: product.vat_id,
                  currency_id: product.currency_id,
                  units_id: product.units_id,
                  partners_id: partnerId || null
                })
                .select('id')
                .single()

              if (accessoryError) {
                console.error('Error creating accessory:', accessoryError)
                return NextResponse.json({ error: 'Hiba a termék létrehozásakor' }, { status: 500 })
              }
              
              console.log(`[SHOP ORDER] Created new accessory: ${newAccessory.id}`)
            }
          } else {
            // This is from materials or linear_materials - skip accessory creation
            console.log(`[SHOP ORDER] Skipping accessory creation for ${product.source}: ${product.name} (${product.sku})`)
          }

          // Add to order items (regardless of source)
          orderItems.push({
            order_id: orderData.id,
            product_name: product.name,
            sku: product.sku || null,
            type: product.type || null,
            base_price: product.base_price,
            multiplier: product.multiplier,
            quantity: product.quantity,
            units_id: product.units_id,
            partner_id: product.partners_id || null,
            vat_id: product.vat_id,
            currency_id: product.currency_id,
            megjegyzes: product.megjegyzes || null,
            status: body.itemStatus || 'open' // Use provided status or default to 'open'
          })
        }

    const { error: itemsError } = await supabaseServer
      .from('shop_order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      return NextResponse.json({ error: 'Hiba a termékek mentésekor' }, { status: 500 })
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
