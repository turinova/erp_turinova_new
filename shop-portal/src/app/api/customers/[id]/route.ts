import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/[id]
 * Fetch a single customer with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch customer with related data
    const { data: customer, error: customerError } = await supabase
      .from('customer_entities')
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Vevő nem található' },
        { status: 404 }
      )
    }

    // Fetch addresses
    const { data: addresses } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_entity_id', id)
      .is('deleted_at', null)
      .order('is_default_billing', { ascending: false })
      .order('is_default_shipping', { ascending: false })
      .order('created_at', { ascending: true })

    // Fetch bank accounts
    const { data: bankAccounts } = await supabase
      .from('customer_bank_accounts')
      .select(`
        *,
        currencies:currency_id(id, code, name, symbol)
      `)
      .eq('customer_entity_id', id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    // Fetch platform mappings
    const { data: platformMappings } = await supabase
      .from('customer_entity_platform_mappings')
      .select(`
        *,
        webshop_connections:connection_id(id, name, platform_type)
      `)
      .eq('customer_entity_id', id)

    return NextResponse.json({
      customer: {
        ...customer,
        addresses: addresses || [],
        bank_accounts: bankAccounts || [],
        platform_mappings: platformMappings || []
      }
    })
  } catch (error) {
    console.error('Error in customers GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/[id]
 * Update a customer
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      entity_type,
      name,
      email,
      telephone,
      website,
      identifier,
      source,
      customer_group_id,
      is_active,
      // Person-specific fields
      firstname,
      lastname,
      // Company-specific fields
      tax_number,
      eu_tax_number,
      group_tax_number,
      company_registration_number,
      notes
    } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A név kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('customer_entities')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik vevő ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if email already exists (if provided and changed)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('customer_entities')
        .select('id')
        .eq('email', email.trim())
        .neq('id', id)
        .is('deleted_at', null)
        .single()

      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Már létezik vevő ezzel az e-mail címmel' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      name: name.trim(),
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
      website: website?.trim() || null,
      identifier: identifier?.trim() || null,
      customer_group_id: customer_group_id || null,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString()
    }

    // Add optional fields if provided
    if (entity_type !== undefined) updateData.entity_type = entity_type
    if (source !== undefined) updateData.source = source
    if (is_active !== undefined) updateData.is_active = is_active

    // Add person-specific fields
    if (entity_type === 'person' || firstname !== undefined || lastname !== undefined) {
      updateData.firstname = firstname?.trim() || null
      updateData.lastname = lastname?.trim() || null
    }

    // Tax number - allow for both person and company
    if (tax_number !== undefined) {
      updateData.tax_number = tax_number?.trim() || null
    }
    
    // Company-specific fields
    if (entity_type === 'company' || eu_tax_number !== undefined || group_tax_number !== undefined || company_registration_number !== undefined) {
      updateData.eu_tax_number = eu_tax_number?.trim() || null
      updateData.group_tax_number = group_tax_number?.trim() || null
      updateData.company_registration_number = company_registration_number?.trim() || null
    } else if (entity_type === 'person') {
      // Clear company-specific fields for person type
      updateData.eu_tax_number = null
      updateData.group_tax_number = null
      updateData.company_registration_number = null
    }

    // Update customer
    const { data, error } = await supabase
      .from('customer_entities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevő frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Vevő nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('Error in customers PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/[id]
 * Soft delete a customer
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete customer
    const { error } = await supabase
      .from('customer_entities')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting customer:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevő törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in customers DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
