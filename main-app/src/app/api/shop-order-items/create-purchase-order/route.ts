import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      shop_order_item_ids,
      warehouse_id,
      expected_date = null,
      existing_po_id = null,
      item_actions
    } = body

    if (!shop_order_item_ids || shop_order_item_ids.length === 0) {
      return NextResponse.json({ error: 'Legalább egy tétel kiválasztása kötelező' }, { status: 400 })
    }

    if (!warehouse_id) {
      return NextResponse.json({ error: 'Raktár kiválasztása kötelező' }, { status: 400 })
    }

    console.log(`[CREATE PO] Processing ${shop_order_item_ids.length} shop order items`)

    // 1. Check if any items already linked to existing POs (exclude deleted POs and deleted PO items)
    const { data: existingLinks, error: checkError } = await supabaseServer
      .from('purchase_order_items')
      .select('shop_order_item_id, purchase_order_id, purchase_orders!inner(po_number, status, deleted_at)')
      .in('shop_order_item_id', shop_order_item_ids)
      .not('shop_order_item_id', 'is', null)
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

    // 2. Fetch selected shop order items with related product data
    const { data: shopOrderItems, error: fetchError } = await supabaseServer
      .from('shop_order_items')
      .select(`
        id, product_name, sku, quantity, base_price, multiplier, megjegyzes, status,
        product_type, accessory_id, material_id, linear_material_id,
        units_id, partner_id, vat_id, currency_id, order_id,
        accessories:accessory_id(name, sku),
        materials:material_id(name),
        linear_materials:linear_material_id(name)
      `)
      .in('id', shop_order_item_ids)
      .is('deleted_at', null)

    if (fetchError || !shopOrderItems) {
      console.error('[CREATE PO] Error fetching items:', fetchError)
      return NextResponse.json({ error: 'Hiba a tételek lekérdezésekor' }, { status: 500 })
    }

    // 3. Validate same partner
    const partnerIds = [...new Set(shopOrderItems.map(item => item.partner_id).filter(Boolean))]
    if (partnerIds.length === 0) {
      return NextResponse.json({ error: 'A kiválasztott tételeknek nincs beszállítója' }, { status: 400 })
    }
    if (partnerIds.length > 1) {
      return NextResponse.json({ error: 'Csak azonos beszállítójú tételeket lehet egyszerre rendelni' }, { status: 400 })
    }

    const partner_id = partnerIds[0]

    // 4. Process items and resolve free-typed
    const poItems = []
    const itemsToUpdate = []
    const suggestionsToUpdate = []
    let newAccessoriesCreated = 0
    let skippedItems = 0

    for (const shopItem of shopOrderItems) {
      const action = item_actions?.find((a: any) => a.item_id === shopItem.id)

      if (action?.action === 'skip') {
        console.log(`[CREATE PO] Skipping item: ${shopItem.product_name}`)
        skippedItems++
        continue
      }

      // Helper function to get actual product name from database
      const getProductDescription = (item: any): string => {
        let productName = ''
        
        // Get name from related table based on product type
        if (item.accessory_id && item.accessories) {
          productName = item.accessories.name || item.product_name
        } else if (item.material_id && item.materials) {
          productName = item.materials.name || item.product_name
        } else if (item.linear_material_id && item.linear_materials) {
          productName = item.linear_materials.name || item.product_name
        } else {
          // Free-typed item - use shop_order_items.product_name
          productName = item.product_name
        }
        
        // Add notes if present
        return productName + (item.megjegyzes ? ` - ${item.megjegyzes}` : '')
      }

      // Item with FK - add directly
      if (shopItem.accessory_id || shopItem.material_id || shopItem.linear_material_id) {
        poItems.push({
          shop_order_item_id: shopItem.id,
          product_type: shopItem.product_type,
          accessory_id: shopItem.accessory_id,
          material_id: shopItem.material_id,
          linear_material_id: shopItem.linear_material_id,
          quantity: shopItem.quantity,
          net_price: Math.round(shopItem.base_price * shopItem.multiplier),
          vat_id: shopItem.vat_id,
          currency_id: shopItem.currency_id,
          units_id: shopItem.units_id,
          description: getProductDescription(shopItem)
        })
        itemsToUpdate.push(shopItem.id)
        continue
      }

      // Free-typed - handle action
      if (action?.action === 'link' && action.accessory_id) {
        // Verify accessory exists and get its name
        const { data: accessory, error: accErr } = await supabaseServer
          .from('accessories')
          .select('id, name')
          .eq('id', action.accessory_id)
          .single()

        if (accErr || !accessory) {
          console.error('[CREATE PO] Accessory not found:', action.accessory_id)
          continue
        }

        poItems.push({
          shop_order_item_id: shopItem.id,
          product_type: 'accessory',
          accessory_id: action.accessory_id,
          material_id: null,
          linear_material_id: null,
          quantity: shopItem.quantity,
          net_price: Math.round(shopItem.base_price * shopItem.multiplier),
          vat_id: shopItem.vat_id,
          currency_id: shopItem.currency_id,
          units_id: shopItem.units_id,
          description: accessory.name + (shopItem.megjegyzes ? ` - ${shopItem.megjegyzes}` : '')
        })

        await supabaseServer
          .from('shop_order_items')
          .update({ accessory_id: action.accessory_id, product_type: 'accessory' })
          .eq('id', shopItem.id)

        suggestionsToUpdate.push({ item_id: shopItem.id, accessory_id: action.accessory_id, status: 'approved' })
        itemsToUpdate.push(shopItem.id)

      } else if (action?.action === 'create' && action.new_accessory_data) {
        // Validate SKU is provided
        if (!action.new_accessory_data.sku || action.new_accessory_data.sku.trim() === '') {
          return NextResponse.json({ 
            error: `SKU megadása kötelező a termékhez: ${shopItem.product_name}` 
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

        // Create new accessory (net_price auto-calculated by trigger)
        const { data: newAccessory, error: createError } = await supabaseServer
          .from('accessories')
          .insert({
            name: action.new_accessory_data.name.trim(),
            sku: action.new_accessory_data.sku.trim(),
            base_price: action.new_accessory_data.base_price,
            multiplier: action.new_accessory_data.multiplier || 1.38,
            partners_id: partner_id,
            units_id: shopItem.units_id,
            currency_id: shopItem.currency_id,
            vat_id: shopItem.vat_id
          })
          .select('id')
          .single()

        if (createError || !newAccessory) {
          console.error('[CREATE PO] Error creating accessory:', createError)
          return NextResponse.json({ error: `Hiba a termék létrehozásakor: ${createError?.message}` }, { status: 500 })
        }

        newAccessoriesCreated++

        poItems.push({
          shop_order_item_id: shopItem.id,
          product_type: 'accessory',
          accessory_id: newAccessory.id,
          material_id: null,
          linear_material_id: null,
          quantity: shopItem.quantity,
          net_price: Math.round(shopItem.base_price * shopItem.multiplier),
          vat_id: shopItem.vat_id,
          currency_id: shopItem.currency_id,
          units_id: shopItem.units_id,
          description: action.new_accessory_data.name.trim() + (shopItem.megjegyzes ? ` - ${shopItem.megjegyzes}` : '')
        })

        await supabaseServer
          .from('shop_order_items')
          .update({ accessory_id: newAccessory.id, product_type: 'accessory' })
          .eq('id', shopItem.id)

        suggestionsToUpdate.push({ item_id: shopItem.id, accessory_id: newAccessory.id, status: 'approved' })
        itemsToUpdate.push(shopItem.id)

      } else {
        console.warn(`[CREATE PO] No valid action for item: ${shopItem.id}`)
        skippedItems++
      }
    }

    if (poItems.length === 0) {
      return NextResponse.json({ error: 'Nincs hozzáadható tétel' }, { status: 400 })
    }

    // 5. Create or use existing Purchase Order
    let purchaseOrder: { id: string; po_number: string }
    let isNewPO = false

    if (existing_po_id) {
      // Use existing PO - verify it exists and is draft
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

      if (existingPO.partner_id !== partner_id) {
        return NextResponse.json({ error: 'A PO beszállítója nem egyezik meg' }, { status: 400 })
      }

      // Update PO's warehouse and expected_date if changed
      const { error: updateError } = await supabaseServer
        .from('purchase_orders')
        .update({
          warehouse_id: warehouse_id,
          expected_date: expected_date || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing_po_id)

      if (updateError) {
        console.error('[CREATE PO] Error updating existing PO:', updateError)
      }

      purchaseOrder = { id: existingPO.id, po_number: existingPO.po_number }
      console.log(`[CREATE PO] Adding to existing PO: ${purchaseOrder.po_number}`)
    } else {
      // Create new PO
      const { data: newPO, error: poError } = await supabaseServer
        .from('purchase_orders')
        .insert({
          partner_id: partner_id,
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

    const { error: itemsError } = await supabaseServer
      .from('purchase_order_items')
      .insert(poItemsWithId)

    if (itemsError) {
      console.error('[CREATE PO] Error adding items:', itemsError)
      // Rollback: Delete the PO
      await supabaseServer.from('purchase_orders').delete().eq('id', purchaseOrder.id)
      return NextResponse.json({ error: 'Hiba a tételek hozzáadásakor' }, { status: 500 })
    }

    // 7. Update product_suggestions to approved
    for (const suggestion of suggestionsToUpdate) {
      await supabaseServer
        .from('product_suggestions')
        .update({ 
          accessory_id: suggestion.accessory_id,
          status: suggestion.status,
          reviewed_at: new Date().toISOString()
        })
        .eq('shop_order_item_id', suggestion.item_id)
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

