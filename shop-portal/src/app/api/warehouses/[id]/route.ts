import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/warehouses/[id]
 * Update a warehouse
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, is_active } = body

    // Validation
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Név és kód kötelező' },
        { status: 400 }
      )
    }

    // Check if code already exists (for another warehouse)
    const { data: existing } = await supabase
      .from('warehouses')
      .select('id')
      .eq('code', code)
      .eq('is_active', true)
      .neq('id', id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ez a kód már létezik' },
        { status: 400 }
      )
    }

    // Update warehouse
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .update({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        is_active: is_active !== undefined ? is_active : true
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating warehouse:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a raktár frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      warehouse
    })
  } catch (error) {
    console.error('Error in warehouses PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/warehouses/[id]
 * Soft delete a warehouse (set is_active to false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if warehouse is used in purchase orders or shipments
    const { data: poCheck } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('warehouse_id', id)
      .is('deleted_at', null)
      .limit(1)

    const { data: shipmentCheck } = await supabase
      .from('shipments')
      .select('id')
      .eq('warehouse_id', id)
      .is('deleted_at', null)
      .limit(1)

    if (poCheck && poCheck.length > 0) {
      return NextResponse.json(
        { error: 'A raktár nem törölhető, mert használatban van beszerzési rendelésekben' },
        { status: 400 }
      )
    }

    if (shipmentCheck && shipmentCheck.length > 0) {
      return NextResponse.json(
        { error: 'A raktár nem törölhető, mert használatban van szállítmányokban' },
        { status: 400 }
      )
    }

    // Soft delete (set is_active to false)
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting warehouse:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a raktár törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      warehouse
    })
  } catch (error) {
    console.error('Error in warehouses DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
