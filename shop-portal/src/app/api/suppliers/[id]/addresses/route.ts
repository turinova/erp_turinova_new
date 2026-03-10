import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/suppliers/[id]/addresses
 * Fetch all addresses for a supplier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: addresses, error } = await supabase
      .from('supplier_addresses')
      .select('*')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching addresses:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a címek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ addresses: addresses || [] })
  } catch (error) {
    console.error('Error in addresses GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers/[id]/addresses
 * Create a new address for a supplier
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      .insert({
        supplier_id: id,
        address_type,
        country: country.trim(),
        postal_code: postal_code?.trim() || null,
        city: city.trim(),
        street: street?.trim() || null,
        address_line_2: address_line_2?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating address:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cím létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ address: data }, { status: 201 })
  } catch (error) {
    console.error('Error in addresses POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
