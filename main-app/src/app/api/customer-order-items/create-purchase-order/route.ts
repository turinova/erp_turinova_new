import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customer_order_item_ids,
      warehouse_id,
      expected_date = null,
      existing_po_id = null,
      item_actions
    } = body

    if (!customer_order_item_ids || customer_order_item_ids.length === 0) {
      return NextResponse.json({ error: 'Legalább egy tétel kiválasztása kötelező' }, { status: 400 })
    }

    if (!warehouse_id) {
      return NextResponse.json({ error: 'Raktár kiválasztása kötelező' }, { status: 400 })
    }

    console.log(`[CREATE PO] Processing ${customer_order_item_ids.length} customer order items`)

    // 1. Check if any items already linked to existing POs
    const { data: existingLinks, error: checkError } = await supabaseServer
      .from('purchase_order_items')
      .select('customer_order_item_id, purchase_order_id, purchase_orders!inner(po_number, status, deleted_at)')
      .in('customer_order_item_id', customer_order_item_ids)
      .not('customer_order_item_id', 'is', null)
      .is('deleted_at', null)
      .is('purchase_orders.deleted_at', null)

    if (checkError) {
      console.error('[CREATE PO] Error checking existing links:', checkError)
      return NextResponse.json({ error: 'Hiba az ellenőrzés során' }, { status: 500 })
    }

    if (existingLinks && existingLinks.length > 0) {
      const linkedItems = existingLinks.map((link: any) => 
        `PO: ${link.purchase_orders.po_number} (${link.purchase_orders.status})`
      ).join(', ')
      return NextResponse.json({ 
        error: `${existingLinks.length} tétel már hozzá van rendelve beszerzési rendeléshez: ${linkedItems}` 
      }, { status: 400 })
    }

    // 2. Fetch selected customer order items with related product data
    const { data: customerOrderItems, error: fetchError } = await supabaseServer
      .from('customer_order_items')
      .select(`
        id, product_name, sku, quantity, unit_price_net, unit_price_gross, status,
        product_type, accessory_id, material_id, linear_material_id,
        vat_id, currency_id, units_id, order_id, shop_order_item_id, partner_id,
        accessories:accessory_id(name, sku, partners_id, units_id, base_price),
        materials:material_id(name, units_id, base_price, partners_id, length_mm, width_mm),
        linear_materials:linear_material_id(name, units_id, base_price, partners_id, length)
      `)
      .in('id', customer_order_item_ids)
      .is('deleted_at', null)
      .eq('item_type', 'product')

    if (fetchError || !customerOrderItems) {
      console.error('[CREATE PO] Error fetching items:', fetchError)
      return NextResponse.json({ error: 'Hiba a tételek lekérdezésekor' }, { status: 500 })
    }

    // 3. Validate same partner (from customer_order_items.partner_id or from related product tables)
    // Priority: 1. customer_order_items.partner_id, 2. accessories.partners_id, 3. materials.partners_id, 4. linear_materials.partners_id
    const partnerIds = [...new Set(
      customerOrderItems
        .map(item => {
          return item.partner_id || 
                 item.accessories?.partners_id || 
                 item.materials?.partners_id || 
                 item.linear_materials?.partners_id
        })
        .filter(Boolean)
    )]
    
    if (partnerIds.length === 0) {
      // Check if we can get partner from items that will be created
      const itemsToCreate = item_actions?.filter((a: any) => a.action === 'create') || []
      if (itemsToCreate.length === 0) {
        return NextResponse.json({ error: 'A kiválasztott tételeknek nincs beszállítója' }, { status: 400 })
      }
      // For items to be created, we'll use the partner from the first item's action or default
      // This will be handled below
    }
    
    if (partnerIds.length > 1) {
      return NextResponse.json({ error: 'Csak azonos beszállítójú tételeket lehet egyszerre rendelni' }, { status: 400 })
    }

    const partner_id = partnerIds[0] || null

    // 4. Process items and resolve free-typed
    const poItems = []
    const itemsToUpdate = []
    let newAccessoriesCreated = 0
    let skippedItems = 0

    for (const customerItem of customerOrderItems) {
      const action = item_actions?.find((a: any) => a.item_id === customerItem.id)

      if (action?.action === 'skip') {
        console.log(`[CREATE PO] Skipping item: ${customerItem.product_name}`)
        skippedItems++
        continue
      }

      // Helper function to get actual product name
      const getProductDescription = (item: any): string => {
        if (item.accessory_id && item.accessories) {
          return item.accessories.name || item.product_name
        } else if (item.material_id && item.materials) {
          return item.materials.name || item.product_name
        } else if (item.linear_material_id && item.linear_materials) {
          return item.linear_materials.name || item.product_name
        }
        return item.product_name
      }

      // Item with FK - add directly
      if (customerItem.accessory_id || customerItem.material_id || customerItem.linear_material_id) {
        // Get units_id from customer_order_items or from related table
        const unitsId = customerItem.units_id || 
          customerItem.accessories?.units_id || 
          customerItem.materials?.units_id || 
          customerItem.linear_materials?.units_id || 
          null
        
        // Calculate purchase price based on product type (same as frontend calculation)
        let purchasePrice: number | null = null
        
        if (customerItem.material_id && customerItem.materials) {
          // For materials: base_price * length_mm * width_mm / 1000000 (convert mm² to m²)
          if (customerItem.materials.length_mm && customerItem.materials.width_mm) {
            purchasePrice = Math.round(customerItem.materials.base_price * customerItem.materials.length_mm * customerItem.materials.width_mm / 1000000)
          } else {
            purchasePrice = customerItem.materials.base_price
          }
        } else if (customerItem.linear_material_id && customerItem.linear_materials) {
          // For linear_materials: base_price * length / 1000 (convert mm to meters)
          if (customerItem.linear_materials.length) {
            purchasePrice = Math.round(customerItem.linear_materials.base_price * customerItem.linear_materials.length / 1000)
          } else {
            purchasePrice = customerItem.linear_materials.base_price
          }
        } else if (customerItem.accessory_id && customerItem.accessories) {
          // For accessories: just use base_price
          purchasePrice = customerItem.accessories.base_price
        }
        
        if (!purchasePrice) {
          console.error(`[CREATE PO] No purchase price found for item ${customerItem.id}`)
          return NextResponse.json({ 
            error: `Nem található beszerzési ár a termékhez: ${customerItem.product_name}` 
          }, { status: 400 })
        }
        
        poItems.push({
          customer_order_item_id: customerItem.id,
          product_type: customerItem.product_type,
          accessory_id: customerItem.accessory_id,
          material_id: customerItem.material_id,
          linear_material_id: customerItem.linear_material_id,
          quantity: customerItem.quantity,
          net_price: purchasePrice, // Use calculated purchase price
          vat_id: customerItem.vat_id,
          currency_id: customerItem.currency_id,
          units_id: unitsId,
          description: getProductDescription(customerItem)
        })
        itemsToUpdate.push(customerItem.id)
        continue
      }

      // Free-typed - handle action
      if (action?.action === 'link' && action.accessory_id) {
        const { data: accessory, error: accErr } = await supabaseServer
          .from('accessories')
          .select('id, name')
          .eq('id', action.accessory_id)
          .single()

        if (accErr || !accessory) {
          console.error('[CREATE PO] Accessory not found:', action.accessory_id)
          continue
        }

        // Get units_id from accessory or customer_order_item
        const { data: accessoryWithUnits } = await supabaseServer
          .from('accessories')
          .select('units_id')
          .eq('id', action.accessory_id)
          .single()
        
        const unitsId = customerItem.units_id || accessoryWithUnits?.units_id || null

        // Get base_price from the linked accessory
        const { data: accessoryWithPrice } = await supabaseServer
          .from('accessories')
          .select('base_price')
          .eq('id', action.accessory_id)
          .single()
        
        if (!accessoryWithPrice?.base_price) {
          console.error(`[CREATE PO] No base_price found for accessory ${action.accessory_id}`)
          return NextResponse.json({ 
            error: `Nem található beszerzési ár a termékhez: ${accessory.name}` 
          }, { status: 400 })
        }
        
        poItems.push({
          customer_order_item_id: customerItem.id,
          product_type: 'accessory',
          accessory_id: action.accessory_id,
          material_id: null,
          linear_material_id: null,
          quantity: customerItem.quantity,
          net_price: Math.round(accessoryWithPrice.base_price), // Use base_price (cost), not unit_price_net (selling price)
          vat_id: customerItem.vat_id,
          currency_id: customerItem.currency_id,
          units_id: unitsId,
          description: accessory.name
        })

        // Update customer_order_item with FK
        await supabaseServer
          .from('customer_order_items')
          .update({ 
            accessory_id: action.accessory_id, 
            product_type: 'accessory' 
          })
          .eq('id', customerItem.id)

        itemsToUpdate.push(customerItem.id)

      } else if (action?.action === 'create' && action.new_accessory_data) {
        // Validate SKU
        if (!action.new_accessory_data.sku || action.new_accessory_data.sku.trim() === '') {
          return NextResponse.json({ 
            error: `SKU megadása kötelező a termékhez: ${customerItem.product_name}` 
          }, { status: 400 })
        }

        // Validate SKU is unique
        const { data: existingSku } = await supabaseServer
          .from('accessories')
          .select('id, sku')
          .eq('sku', action.new_accessory_data.sku.trim())
          .is('deleted_at', null)
          .maybeSingle()

        if (existingSku) {
          return NextResponse.json({ 
            error: `SKU már létezik: ${action.new_accessory_data.sku}. Válassz másik SKU-t.` 
          }, { status: 400 })
        }

        // Use partner_id from existing items or from action
        const finalPartnerId = partner_id || action.new_accessory_data.partners_id

        if (!finalPartnerId) {
          return NextResponse.json({ 
            error: 'Beszállító megadása kötelező' 
          }, { status: 400 })
        }

        // Create new accessory
        const { data: newAccessory, error: createError } = await supabaseServer
          .from('accessories')
          .insert({
            name: action.new_accessory_data.name.trim(),
            sku: action.new_accessory_data.sku.trim(),
            base_price: action.new_accessory_data.base_price,
            multiplier: action.new_accessory_data.multiplier || 1.38,
            partners_id: finalPartnerId,
            units_id: customerItem.units_id || null,
            currency_id: customerItem.currency_id,
            vat_id: customerItem.vat_id
          })
          .select('id')
          .single()

        if (createError || !newAccessory) {
          console.error('[CREATE PO] Error creating accessory:', createError)
          return NextResponse.json({ error: `Hiba a termék létrehozásakor: ${createError?.message}` }, { status: 500 })
        }

        newAccessoriesCreated++

        poItems.push({
          customer_order_item_id: customerItem.id,
          product_type: 'accessory',
          accessory_id: newAccessory.id,
          material_id: null,
          linear_material_id: null,
          quantity: customerItem.quantity,
          net_price: Math.round(action.new_accessory_data.base_price), // Use base_price (cost) from the new accessory data
          vat_id: customerItem.vat_id,
          currency_id: customerItem.currency_id,
          units_id: customerItem.units_id || action.new_accessory_data.units_id || null,
          description: action.new_accessory_data.name.trim()
        })

        // Update customer_order_item with FK
        await supabaseServer
          .from('customer_order_items')
          .update({ 
            accessory_id: newAccessory.id, 
            product_type: 'accessory' 
          })
          .eq('id', customerItem.id)

        itemsToUpdate.push(customerItem.id)

      } else {
        console.warn(`[CREATE PO] No valid action for item: ${customerItem.id}`)
        skippedItems++
      }
    }

    if (poItems.length === 0) {
      return NextResponse.json({ error: 'Nincs hozzáadható tétel' }, { status: 400 })
    }

    // 5. Create or use existing Purchase Order
    let purchaseOrder: { id: string; po_number: string }
    let isNewPO = false

    // Determine final partner_id (from items or from first item to be created)
    const finalPartnerId = partner_id || (item_actions?.find((a: any) => a.action === 'create')?.new_accessory_data?.partners_id)

    if (!finalPartnerId) {
      return NextResponse.json({ error: 'Beszállító megadása kötelező' }, { status: 400 })
    }

    if (existing_po_id) {
      const { data: existingPO, error: fetchPOError } = await supabaseServer
        .from('purchase_orders')
        .select('id, po_number, status, partner_id')
        .eq('id', existing_po_id)
        .is('deleted_at', null)
        .single()

      if (fetchPOError || !existingPO) {
        return NextResponse.json({ error: 'A kiválasztott PO nem található' }, { status: 404 })
      }

      if (existingPO.status !== 'draft') {
        return NextResponse.json({ error: 'Csak vázlat státuszú PO-hoz lehet tételt hozzáadni' }, { status: 400 })
      }

      if (existingPO.partner_id !== finalPartnerId) {
        return NextResponse.json({ error: 'A PO beszállítója nem egyezik meg' }, { status: 400 })
      }

      await supabaseServer
        .from('purchase_orders')
        .update({
          warehouse_id: warehouse_id,
          expected_date: expected_date || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing_po_id)

      purchaseOrder = { id: existingPO.id, po_number: existingPO.po_number }
      console.log(`[CREATE PO] Adding to existing PO: ${purchaseOrder.po_number}`)
    } else {
      // Create new PO
      const { data: newPO, error: poError } = await supabaseServer
        .from('purchase_orders')
        .insert({
          partner_id: finalPartnerId,
          warehouse_id: warehouse_id,
          order_date: new Date().toISOString().slice(0, 10),
          expected_date: expected_date,
          source_type: 'customer_order',
          status: 'draft'
        })
        .select('id, po_number')
        .single()

      if (poError || !newPO) {
        console.error('[CREATE PO] Error creating PO:', poError)
        return NextResponse.json({ error: 'Hiba a PO létrehozásakor' }, { status: 500 })
      }

      purchaseOrder = newPO
      isNewPO = true
      console.log(`[CREATE PO] Created new PO: ${purchaseOrder.po_number}`)
    }

    // 6. Add items to PO
    const poItemsWithId = poItems.map(item => ({
      ...item,
      purchase_order_id: purchaseOrder.id
    }))

    const { data: insertedPOItems, error: itemsError } = await supabaseServer
      .from('purchase_order_items')
      .insert(poItemsWithId)
      .select('id, customer_order_item_id')

    if (itemsError) {
      console.error('[CREATE PO] Error adding items:', itemsError)
      if (isNewPO) {
        await supabaseServer.from('purchase_orders').delete().eq('id', purchaseOrder.id)
      }
      return NextResponse.json({ error: 'Hiba a tételek hozzáadásakor' }, { status: 500 })
    }

    // 7. Update customer_order_items with purchase_order_item_id
    // Note: Status will be automatically updated to 'in_po' by trigger when PO item is created
    if (!insertedPOItems || insertedPOItems.length === 0) {
      console.error('[CREATE PO] No PO items were inserted')
      return NextResponse.json({ error: 'Hiba: nincs beszúrt PO tétel' }, { status: 500 })
    }

    let updatedCount = 0
    for (let i = 0; i < itemsToUpdate.length; i++) {
      const customerItemId = itemsToUpdate[i]
      const poItem = insertedPOItems?.find((poi: any) => poi.customer_order_item_id === customerItemId)
      
      if (!poItem) {
        console.error(`[CREATE PO] Could not find PO item for customer_order_item_id: ${customerItemId}`)
        console.log(`[CREATE PO] Available PO items:`, insertedPOItems?.map((poi: any) => ({ id: poi.id, customer_order_item_id: poi.customer_order_item_id })))
        continue
      }
      
      const { error: updateError } = await supabaseServer
        .from('customer_order_items')
        .update({ 
          purchase_order_item_id: poItem.id
          // Status will be updated to 'in_po' by trigger
        })
        .eq('id', customerItemId)
      
      if (updateError) {
        console.error(`[CREATE PO] Error updating customer_order_item ${customerItemId}:`, updateError)
      } else {
        updatedCount++
        console.log(`[CREATE PO] Updated customer_order_item ${customerItemId} with purchase_order_item_id ${poItem.id}`)
      }
    }

    if (updatedCount !== itemsToUpdate.length) {
      console.warn(`[CREATE PO] Warning: Only ${updatedCount} of ${itemsToUpdate.length} customer_order_items were updated`)
    }

    console.log(`[CREATE PO] Success: ${isNewPO ? 'Created' : 'Added to'} ${purchaseOrder.po_number} with ${poItems.length} items`)

    return NextResponse.json({
      success: true,
      purchase_order_id: purchaseOrder.id,
      po_number: purchaseOrder.po_number,
      items_added: poItems.length,
      items_skipped: skippedItems,
      new_accessories_created: newAccessoriesCreated,
      is_new_po: isNewPO
    })

  } catch (error) {
    console.error('[CREATE PO] Error:', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

