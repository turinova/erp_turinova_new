import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product_type, product_id, new_base_price, new_multiplier, shipment_id } = body

    // Validate input
    if (!product_type || !product_id || new_base_price === undefined || new_multiplier === undefined) {
      return NextResponse.json(
        { error: 'product_type, product_id, new_base_price, and new_multiplier are required' },
        { status: 400 }
      )
    }

    if (!['accessory', 'material', 'linear_material'].includes(product_type)) {
      return NextResponse.json(
        { error: 'Invalid product_type. Must be accessory, material, or linear_material' },
        { status: 400 }
      )
    }

    if (typeof new_base_price !== 'number' || new_base_price <= 0) {
      return NextResponse.json(
        { error: 'new_base_price must be a positive number' },
        { status: 400 }
      )
    }

    // Get authenticated user for price history tracking
    const cookieStore = await cookies()
    const supabaseWithAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )
    
    const { data: { user } } = await supabaseWithAuth.auth.getUser()

    // Update base_price in the appropriate table
    let tableName: string
    if (product_type === 'accessory') {
      tableName = 'accessories'
    } else if (product_type === 'material') {
      tableName = 'materials'
    } else {
      tableName = 'linear_materials'
    }

    // FIRST: Fetch current values before update - select only columns that exist per table
    let selectColumns: string
    if (product_type === 'accessory') {
      selectColumns = 'base_price, multiplier, currency_id, vat_id, net_price'
    } else if (product_type === 'material') {
      selectColumns = 'base_price, multiplier, currency_id, vat_id, price_per_sqm'
    } else { // linear_material
      selectColumns = 'base_price, multiplier, currency_id, vat_id, price_per_m'
    }

    const { data: currentData, error: fetchError } = await supabaseServer
      .from(tableName)
      .select(selectColumns)
      .eq('id', product_id)
      .is('deleted_at', null) // Filter out soft-deleted records
      .single()

    if (fetchError || !currentData) {
      console.error(`Error fetching ${product_type} for update:`, fetchError)
      return NextResponse.json(
        { error: `${product_type} nem található` },
        { status: 404 }
      )
    }

    // Update both base_price and multiplier
    const { data, error } = await supabaseServer
      .from(tableName)
      .update({
        base_price: Math.round(new_base_price),
        multiplier: parseFloat(new_multiplier.toFixed(3)),
        updated_at: new Date().toISOString()
      })
      .eq('id', product_id)
      .is('deleted_at', null) // Filter out soft-deleted records
      .select(selectColumns)
      .single()

    if (error) {
      console.error(`Error updating ${product_type} base_price:`, error)
      return NextResponse.json(
        { error: `Hiba a ${product_type} base_price frissítésekor: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: `${product_type} nem található` },
        { status: 404 }
      )
    }

    // Track price history if base_price or multiplier changed
    const basePriceChanged = currentData.base_price !== Math.round(new_base_price)
    const multiplierChanged = currentData.multiplier !== parseFloat(new_multiplier.toFixed(3))
    
    if (basePriceChanged || multiplierChanged) {
      console.log(`Price changed - base_price: ${currentData.base_price} -> ${new_base_price}, multiplier: ${currentData.multiplier} -> ${new_multiplier}, logging to history`)
      
      if (product_type === 'material') {
        // Calculate new price_per_sqm (trigger will update it, but we need it for history)
        const new_price_per_sqm = Math.round(new_base_price * parseFloat(new_multiplier.toFixed(3)))
        
        const historyData = {
          material_id: product_id,
          old_base_price: currentData.base_price,
          new_base_price: Math.round(new_base_price),
          old_multiplier: currentData.multiplier,
          new_multiplier: parseFloat(new_multiplier.toFixed(3)),
          old_price_per_sqm: currentData.price_per_sqm,
          new_price_per_sqm: new_price_per_sqm,
          old_currency_id: currentData.currency_id,
          new_currency_id: currentData.currency_id,
          old_vat_id: currentData.vat_id,
          new_vat_id: currentData.vat_id,
          changed_by: user?.id || null,
          source_type: 'shipment',
          source_reference: shipment_id || null
        }
        
        const { error: historyError } = await supabaseServer
          .from('material_price_history')
          .insert(historyData)
        
        if (historyError) {
          console.error('Error logging material price history:', historyError)
        } else {
          console.log('Material price history logged successfully')
        }
      } else if (product_type === 'linear_material') {
        // Calculate new price_per_m (trigger will update it, but we need it for history)
        const new_price_per_m = Math.round(new_base_price * parseFloat(new_multiplier.toFixed(3)))
        
        const historyData = {
          linear_material_id: product_id,
          old_base_price: currentData.base_price,
          new_base_price: Math.round(new_base_price),
          old_multiplier: currentData.multiplier,
          new_multiplier: parseFloat(new_multiplier.toFixed(3)),
          old_price: currentData.price_per_m,
          new_price: new_price_per_m,
          old_currency_id: currentData.currency_id,
          new_currency_id: currentData.currency_id,
          old_vat_id: currentData.vat_id,
          new_vat_id: currentData.vat_id,
          changed_by: user?.id || null,
          changed_at: new Date().toISOString(),
          source_type: 'shipment',
          source_reference: shipment_id || null
        }
        
        const { error: historyError } = await supabaseServer
          .from('linear_material_price_history')
          .insert(historyData)
        
        if (historyError) {
          console.error('Error logging linear material price history:', historyError)
        } else {
          console.log('Linear material price history logged successfully')
        }
      } else if (product_type === 'accessory') {
        // Calculate new net_price (trigger will update it, but we need it for history)
        const new_net_price = Math.round(new_base_price * parseFloat(new_multiplier.toFixed(3)))
        
        const historyData = {
          accessory_id: product_id,
          old_base_price: currentData.base_price,
          new_base_price: Math.round(new_base_price),
          old_multiplier: currentData.multiplier,
          new_multiplier: parseFloat(new_multiplier.toFixed(3)),
          old_net_price: currentData.net_price,
          new_net_price: new_net_price,
          old_currency_id: currentData.currency_id,
          new_currency_id: currentData.currency_id,
          old_vat_id: currentData.vat_id,
          new_vat_id: currentData.vat_id,
          changed_by: user?.id || null,
          source_type: 'shipment',
          source_reference: shipment_id || null
        }
        
        const { error: historyError } = await supabaseServer
          .from('accessory_price_history')
          .insert(historyData)
        
        if (historyError) {
          console.error('Error logging accessory price history:', historyError)
        } else {
          console.log('Accessory price history logged successfully')
        }
      }
    }

    return NextResponse.json({
      success: true,
      product_id: data.id,
      new_base_price: data.base_price,
      new_multiplier: data.multiplier
    })
  } catch (error: any) {
    console.error('Error in update-base-price API:', error)
    return NextResponse.json(
      { error: error.message || 'Hiba a base_price frissítésekor' },
      { status: 500 }
    )
  }
}

