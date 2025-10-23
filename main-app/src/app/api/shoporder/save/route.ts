import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
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

    // Generate order number using database function
    const { data: orderNumberData, error: orderNumberError } = await supabaseServer
      .rpc('generate_shop_order_number')
    
    if (orderNumberError) {
      console.error('Error generating order number:', orderNumberError)
      return NextResponse.json({ error: 'Hiba a rendelésszám generálásakor' }, { status: 500 })
    }

    const orderNumber = orderNumberData

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

    // Start transaction - create order first
    const { data: orderData, error: orderError } = await supabaseServer
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
        billing_company_reg_number: body.billing_company_reg_number || null
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json({ error: 'Hiba a rendelés létrehozásakor' }, { status: 500 })
    }

        // Process products and create accessories if needed
        const orderItems = []
        for (const product of body.products) {
          let accessoryId = null
          
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
            let partnerId = product.partners_id
            if (!partnerId) {
              const { data: defaultPartner } = await supabaseServer
                .from('partners')
                .select('id')
                .limit(1)
                .single()
              partnerId = defaultPartner?.id
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
                partners_id: partnerId
              })
              .select('id')
              .single()

            if (accessoryError) {
              console.error('Error creating accessory:', accessoryError)
              return NextResponse.json({ error: 'Hiba a termék létrehozásakor' }, { status: 500 })
            }
            accessoryId = newAccessory.id
          }

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
