import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/suppliers/[id]/addresses/[addressId]
 * Update an address
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { addressId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { address_type, country, postal_code, city, street, address_line_2 } = body

    // Validation
    if (!address_type || !country || !city) {
      return NextResponse.json(
        { error: 'A cím típusa, ország és város kötelező' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('supplier_addresses')
      .update({
        address_type,
        country: country.trim(),
        postal_code: postal_code?.trim() || null,
        city: city.trim(),
        street: street?.trim() || null,
        address_line_2: address_line_2?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', addressId)
      .select()
      .single()

    if (error) {
      console.error('Error updating address:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cím frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cím nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ address: data })
  } catch (error) {
    console.error('Error in addresses PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers/[id]/addresses/[addressId]
 * Soft delete an address
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { addressId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('supplier_addresses')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', addressId)

    if (error) {
      console.error('Error deleting address:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cím törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in addresses DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
