import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/companies/[id]/addresses
 * Fetch all addresses for a company
 */
export async function GET(
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

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('customer_companies')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Cég nem található' },
        { status: 404 }
      )
    }

    // Fetch addresses (check both company_id and customer_entity_id for backward compatibility)
    const { data: addresses, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .or(`company_id.eq.${id},customer_entity_id.eq.${id}`)
      .is('deleted_at', null)
      .order('is_default_billing', { ascending: false })
      .order('is_default_shipping', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching company addresses:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a címek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      addresses: addresses || []
    })
  } catch (error) {
    console.error('Error in company addresses GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/companies/[id]/addresses
 * Add a new address to a company
 */
export async function POST(
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

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('customer_companies')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Cég nem található' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      address_type = 'billing',
      firstname,
      lastname,
      company: companyName,
      address1,
      address2,
      postcode,
      city,
      country_code = 'HU',
      zone_name,
      telephone,
      is_default_billing = false,
      is_default_shipping = false
    } = body

    // Validation
    if (!address1 || !address1.trim()) {
      return NextResponse.json(
        { error: 'A cím kötelező' },
        { status: 400 }
      )
    }

    if (!postcode || !postcode.trim()) {
      return NextResponse.json(
        { error: 'Az irányítószám kötelező' },
        { status: 400 }
      )
    }

    if (!city || !city.trim()) {
      return NextResponse.json(
        { error: 'A város kötelező' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults
    if (is_default_billing) {
      await supabase
        .from('customer_addresses')
        .update({ is_default_billing: false })
        .or(`company_id.eq.${id},customer_entity_id.eq.${id}`)
        .is('deleted_at', null)
    }

    if (is_default_shipping) {
      await supabase
        .from('customer_addresses')
        .update({ is_default_shipping: false })
        .or(`company_id.eq.${id},customer_entity_id.eq.${id}`)
        .is('deleted_at', null)
    }

    // Create address
    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({
        company_id: id,
        address_type: address_type || 'billing',
        firstname: firstname?.trim() || null,
        lastname: lastname?.trim() || null,
        company: companyName?.trim() || null,
        address1: address1.trim(),
        address2: address2?.trim() || null,
        postcode: postcode.trim(),
        city: city.trim(),
        country_code: country_code || 'HU',
        zone_name: zone_name?.trim() || null,
        telephone: telephone?.trim() || null,
        is_default_billing: is_default_billing || false,
        is_default_shipping: is_default_shipping || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating company address:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cím létrehozásakor' },
        { status: 500 }
      )
    }

    // Update company's default address references if needed
    if (is_default_billing) {
      await supabase
        .from('customer_companies')
        .update({ default_billing_address_id: data.id })
        .eq('id', id)
    }

    if (is_default_shipping) {
      await supabase
        .from('customer_companies')
        .update({ default_shipping_address_id: data.id })
        .eq('id', id)
    }

    return NextResponse.json({ address: data }, { status: 201 })
  } catch (error) {
    console.error('Error in company addresses POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
