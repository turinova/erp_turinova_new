import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/[id]/addresses/[addressId]
 * Fetch a single address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch address
    const { data: address, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('id', addressId)
      .eq('customer_entity_id', id)
      .is('deleted_at', null)
      .single()

    if (error || !address) {
      return NextResponse.json(
        { error: 'Cím nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ address })
  } catch (error) {
    console.error('Error in customer address GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/[id]/addresses/[addressId]
 * Update an address
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      address_type,
      firstname,
      lastname,
      company,
      address1,
      address2,
      postcode,
      city,
      country_code,
      zone_name,
      telephone,
      is_default_billing,
      is_default_shipping
    } = body

    // Validation
    if (address1 !== undefined && !address1?.trim()) {
      return NextResponse.json(
        { error: 'A cím kötelező' },
        { status: 400 }
      )
    }

    if (postcode !== undefined && !postcode?.trim()) {
      return NextResponse.json(
        { error: 'Az irányítószám kötelező' },
        { status: 400 }
      )
    }

    if (city !== undefined && !city?.trim()) {
      return NextResponse.json(
        { error: 'A város kötelező' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults
    if (is_default_billing === true) {
      await supabase
        .from('customer_addresses')
        .update({ is_default_billing: false })
        .eq('customer_entity_id', id)
        .neq('id', addressId)
        .is('deleted_at', null)
    }

    if (is_default_shipping === true) {
      await supabase
        .from('customer_addresses')
        .update({ is_default_shipping: false })
        .eq('customer_entity_id', id)
        .neq('id', addressId)
        .is('deleted_at', null)
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (address_type !== undefined) updateData.address_type = address_type
    if (firstname !== undefined) updateData.firstname = firstname?.trim() || null
    if (lastname !== undefined) updateData.lastname = lastname?.trim() || null
    if (company !== undefined) updateData.company = company?.trim() || null
    if (address1 !== undefined) updateData.address1 = address1.trim()
    if (address2 !== undefined) updateData.address2 = address2?.trim() || null
    if (postcode !== undefined) updateData.postcode = postcode.trim()
    if (city !== undefined) updateData.city = city.trim()
    if (country_code !== undefined) updateData.country_code = country_code
    if (zone_name !== undefined) updateData.zone_name = zone_name?.trim() || null
    if (telephone !== undefined) updateData.telephone = telephone?.trim() || null
    if (is_default_billing !== undefined) updateData.is_default_billing = is_default_billing
    if (is_default_shipping !== undefined) updateData.is_default_shipping = is_default_shipping

    // Update address
    const { data, error } = await supabase
      .from('customer_addresses')
      .update(updateData)
      .eq('id', addressId)
      .eq('customer_entity_id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer address:', error)
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

    // Update customer's default address references if needed
    if (is_default_billing === true) {
      await supabase
        .from('customer_entities')
        .update({ default_billing_address_id: data.id })
        .eq('id', id)
    } else if (is_default_billing === false) {
      // If unsetting default, clear the reference if it was this address
      const { data: customer } = await supabase
        .from('customer_entities')
        .select('default_billing_address_id')
        .eq('id', id)
        .single()
      
      if (customer?.default_billing_address_id === addressId) {
        await supabase
          .from('customer_entities')
          .update({ default_billing_address_id: null })
          .eq('id', id)
      }
    }

    if (is_default_shipping === true) {
      await supabase
        .from('customer_entities')
        .update({ default_shipping_address_id: data.id })
        .eq('id', id)
    } else if (is_default_shipping === false) {
      // If unsetting default, clear the reference if it was this address
      const { data: customer } = await supabase
        .from('customer_entities')
        .select('default_shipping_address_id')
        .eq('id', id)
        .single()
      
      if (customer?.default_shipping_address_id === addressId) {
        await supabase
          .from('customer_entities')
          .update({ default_shipping_address_id: null })
          .eq('id', id)
      }
    }

    return NextResponse.json({ address: data })
  } catch (error) {
    console.error('Error in customer address PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/[id]/addresses/[addressId]
 * Soft delete an address
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if address is a default address
    const { data: address } = await supabase
      .from('customer_addresses')
      .select('is_default_billing, is_default_shipping')
      .eq('id', addressId)
      .eq('customer_entity_id', id)
      .is('deleted_at', null)
      .single()

    if (!address) {
      return NextResponse.json(
        { error: 'Cím nem található' },
        { status: 404 }
      )
    }

    // Soft delete address
    const { error } = await supabase
      .from('customer_addresses')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', addressId)
      .eq('customer_entity_id', id)

    if (error) {
      console.error('Error deleting customer address:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cím törlésekor' },
        { status: 500 }
      )
    }

    // Clear default address references if this was a default
    if (address.is_default_billing || address.is_default_shipping) {
      const updateData: any = {}
      if (address.is_default_billing) {
        updateData.default_billing_address_id = null
      }
      if (address.is_default_shipping) {
        updateData.default_shipping_address_id = null
      }
      await supabase
        .from('customer_entities')
        .update(updateData)
        .eq('id', id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in customer address DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
