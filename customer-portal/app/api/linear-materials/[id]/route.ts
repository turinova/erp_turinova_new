import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Get single linear material
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data, error } = await supabaseServer
      .from('linear_materials')
      .select(`
        *,
        brands (name),
        currencies (name),
        vat (name, kulcs)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Linear material not found' }, { status: 404 })
    }

    // Fetch machine code
    const { data: machineData } = await supabaseServer
      .from('machine_linear_material_map')
      .select('machine_code')
      .eq('linear_material_id', id)
      .eq('machine_type', 'Korpus')
      .single()

    return NextResponse.json({
      ...data,
      machine_code: machineData?.machine_code || ''
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update linear material
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get current data for price history
    const { data: currentData } = await supabaseServer
      .from('linear_materials')
      .select('price_per_m, currency_id, vat_id')
      .eq('id', id)
      .single()

    const updateData = {
      brand_id: body.brand_id,
      name: body.name,
      width: parseFloat(body.width) || 0,
      length: parseFloat(body.length) || 0,
      thickness: parseFloat(body.thickness) || 0,
      type: body.type,
      image_url: body.image_url,
      base_price: parseFloat(body.base_price) || 0,
      multiplier: parseFloat(body.multiplier) || 1.38,
      price_per_m: parseFloat(body.price_per_m) || 0,
      partners_id: body.partners_id || null,
      units_id: body.units_id || null,
      currency_id: body.currency_id,
      vat_id: body.vat_id,
      on_stock: body.on_stock,
      active: body.active,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabaseServer
      .from('linear_materials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating linear material:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update machine code
    if (body.machine_code !== undefined) {
      const { data: existing } = await supabaseServer
        .from('machine_linear_material_map')
        .select('id')
        .eq('linear_material_id', id)
        .eq('machine_type', 'Korpus')
        .single()

      if (existing) {
        await supabaseServer
          .from('machine_linear_material_map')
          .update({ machine_code: body.machine_code })
          .eq('linear_material_id', id)
          .eq('machine_type', 'Korpus')
      } else {
        await supabaseServer
          .from('machine_linear_material_map')
          .insert({
            linear_material_id: id,
            machine_type: 'Korpus',
            machine_code: body.machine_code
          })
      }
    }

    // Track price history (only if price/currency/vat changed AND not first save)
    if (currentData) {
      const priceChanged = currentData.price_per_m !== updateData.price_per_m
      const currencyChanged = currentData.currency_id !== updateData.currency_id
      const vatChanged = currentData.vat_id !== updateData.vat_id

      if (priceChanged || currencyChanged || vatChanged) {
        console.log(`Price changed from ${currentData.price_per_m} to ${updateData.price_per_m}, logging to history`)
        
        // Create supabase client with cookies to get authenticated user
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
        
        const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser()
        
        if (userError) {
          console.error('Error getting user:', userError)
        }
        
        console.log('Current user for price history:', user?.id, user?.email)
        
        const historyData = {
          linear_material_id: id,
          old_price: currentData.price_per_m,
          new_price: updateData.price_per_m,
          old_currency_id: currentData.currency_id,
          new_currency_id: updateData.currency_id,
          old_vat_id: currentData.vat_id,
          new_vat_id: updateData.vat_id,
          changed_by: user?.id || null,
          changed_at: new Date().toISOString()
        }
        
        console.log('Inserting price history:', historyData)
        
        const { error: historyError } = await supabaseServer
          .from('linear_material_price_history')
          .insert(historyData)
        
        if (historyError) {
          console.error('Error logging price history:', historyError)
        } else {
          console.log('Price history logged successfully for user:', user?.email)
        }
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Soft delete linear material
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error } = await supabaseServer
      .from('linear_materials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deleting linear material:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

