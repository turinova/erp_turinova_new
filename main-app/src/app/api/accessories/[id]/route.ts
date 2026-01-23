import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data, error } = await supabaseServer
      .from('accessories')
      .select(`
        id, 
        name, 
        sku, 
        barcode,
        barcode_u,
        base_price,
        multiplier,
        net_price,
        gross_price,
        image_url,
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching accessory:', error)
      return NextResponse.json({ error: 'Accessory not found' }, { status: 404 })
    }

    // Transform the data to include calculated fields
    // Use stored gross_price if available, otherwise calculate as fallback
    const calculatedGrossPrice = data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
    const finalGrossPrice = data.gross_price !== null ? data.gross_price : calculatedGrossPrice
    
    const transformedData = {
      ...data,
      vat_name: data.vat?.name || '',
      vat_percent: data.vat?.kulcs || 0,
      currency_name: data.currencies?.name || '',
      unit_name: data.units?.name || '',
      unit_shortform: data.units?.shortform || '',
      partner_name: data.partners?.name || '',
      vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
      gross_price: finalGrossPrice
    }

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in accessory GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, sku, barcode, barcode_u, base_price, multiplier, gross_price, vat_id, currency_id, units_id, partners_id, image_url } = body

    // Validate required fields
    if (!name || !sku || base_price === undefined || multiplier === undefined || !vat_id || !currency_id || !units_id || !partners_id) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate base_price is a positive number
    if (typeof base_price !== 'number' || base_price < 0) {
      return NextResponse.json({ error: 'Base price must be a positive number' }, { status: 400 })
    }

    // Validate multiplier is between 1.0 and 5.0
    if (typeof multiplier !== 'number' || multiplier < 1.0 || multiplier > 5.0) {
      return NextResponse.json({ error: 'Multiplier must be between 1.0 and 5.0' }, { status: 400 })
    }

    // Calculate net_price from base_price and multiplier
    // If gross_price is provided, use it; otherwise calculate from base_price and multiplier
    let net_price = Math.round(base_price * multiplier)
    
    // If gross_price is provided, calculate net_price from it
    if (gross_price !== undefined && gross_price !== null) {
      // Get VAT rate to calculate net_price from gross_price
      const { data: vatData } = await supabaseServer
        .from('vat')
        .select('kulcs')
        .eq('id', vat_id)
        .single()
      
      if (vatData) {
        const vatRate = vatData.kulcs
        // net_price = gross_price / (1 + vatRate/100)
        net_price = Math.round(gross_price / (1 + vatRate / 100))
      }
    }

    // FIRST: Get current accessory to check if price changed
    const { data: currentAccessory } = await supabaseServer
      .from('accessories')
      .select('base_price, multiplier, net_price, currency_id, vat_id')
      .eq('id', id)
      .single()

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
    console.log('Current user for accessory price history:', user?.id, user?.email)

    console.log(`Updating accessory ${id}`)

    // Calculate gross_price: use provided value or calculate from net_price + VAT
    let finalGrossPrice = gross_price
    if (finalGrossPrice === undefined || finalGrossPrice === null) {
      const { data: vatData } = await supabaseServer
        .from('vat')
        .select('kulcs')
        .eq('id', vat_id)
        .single()
      
      if (vatData) {
        finalGrossPrice = Math.round(net_price + (net_price * vatData.kulcs / 100))
      } else {
        finalGrossPrice = net_price
      }
    } else {
      finalGrossPrice = Math.round(finalGrossPrice)
    }

    const { data, error } = await supabaseServer
      .from('accessories')
      .update({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode ? barcode.trim() : null,
        barcode_u: barcode_u ? barcode_u.trim() : null,
        base_price: Math.round(base_price),
        multiplier: parseFloat(multiplier.toFixed(3)),
        net_price: net_price,
        gross_price: finalGrossPrice,
        image_url: image_url || null,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        id, 
        name, 
        sku, 
        barcode,
        barcode_u,
        base_price,
        multiplier,
        net_price,
        gross_price,
        image_url,
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating accessory:', error)
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
      }
      
      return NextResponse.json({ error: 'Failed to update accessory' }, { status: 500 })
    }

    // Track price history if any price-related field changed
    if (currentAccessory) {
      const basePriceChanged = currentAccessory.base_price !== Math.round(base_price)
      const multiplierChanged = currentAccessory.multiplier !== parseFloat(multiplier.toFixed(2))
      const netPriceChanged = currentAccessory.net_price !== net_price
      const currencyChanged = currentAccessory.currency_id !== currency_id
      const vatChanged = currentAccessory.vat_id !== vat_id

      if (basePriceChanged || multiplierChanged || netPriceChanged || currencyChanged || vatChanged) {
        console.log(`Accessory price changed, logging to history`)
        
        const historyData = {
          accessory_id: id,
          old_base_price: currentAccessory.base_price,
          new_base_price: Math.round(base_price),
          old_multiplier: currentAccessory.multiplier,
          new_multiplier: parseFloat(multiplier.toFixed(2)),
          old_net_price: currentAccessory.net_price,
          new_net_price: net_price,
          old_currency_id: currentAccessory.currency_id,
          new_currency_id: currency_id,
          old_vat_id: currentAccessory.vat_id,
          new_vat_id: vat_id,
          changed_by: user?.id || null,
          source_type: 'edit_page',
          source_reference: null
        }
        
        const { error: historyError } = await supabaseServer
          .from('accessory_price_history')
          .insert(historyData)
        
        if (historyError) {
          console.error('Error logging accessory price history:', historyError)
          // Don't fail the update if history logging fails
        } else {
          console.log('Accessory price history logged successfully')
        }
      }
    }

    // Transform the data to include calculated fields
    // Use stored gross_price if available, otherwise calculate as fallback
    const calculatedGrossPriceResponse = data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
    const finalGrossPriceResponse = data.gross_price !== null ? data.gross_price : calculatedGrossPriceResponse
    
    const transformedData = {
      ...data,
      vat_name: data.vat?.name || '',
      vat_percent: data.vat?.kulcs || 0,
      currency_name: data.currencies?.name || '',
      unit_name: data.units?.name || '',
      unit_shortform: data.units?.shortform || '',
      partner_name: data.partners?.name || '',
      vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
      gross_price: finalGrossPriceResponse
    }

    console.log('Accessory updated successfully:', transformedData.name)
    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in accessory PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Deleting accessory ${id}`)

    const { data, error } = await supabaseServer
      .from('accessories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('name')
      .single()

    if (error) {
      console.error('Error deleting accessory:', error)
      return NextResponse.json({ error: 'Failed to delete accessory' }, { status: 500 })
    }

    console.log('Accessory deleted successfully:', data.name)
    return NextResponse.json({ message: 'Accessory deleted successfully' })

  } catch (error) {
    console.error('Error in accessory DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
