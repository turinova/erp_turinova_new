import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/persons/[id]
 * Fetch a single person with all related data
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

    // Fetch person with related data
    const { data: person, error: personError } = await supabase
      .from('customer_persons')
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Személy nem található' },
        { status: 404 }
      )
    }

    // Fetch addresses (check both person_id and customer_entity_id for backward compatibility)
    const { data: addresses } = await supabase
      .from('customer_addresses')
      .select('*')
      .or(`person_id.eq.${id},customer_entity_id.eq.${id}`)
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
      .or(`person_id.eq.${id},customer_entity_id.eq.${id}`)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    // Fetch platform mappings
    const { data: platformMappings } = await supabase
      .from('customer_platform_mappings')
      .select(`
        *,
        webshop_connections:connection_id(id, name, platform_type, is_active)
      `)
      .eq('person_id', id)

    // Fetch relationships (companies this person is linked to)
    const { data: relationships } = await supabase
      .from('customer_person_company_relationships')
      .select(`
        *,
        companies:company_id(id, name, email, telephone)
      `)
      .eq('person_id', id)
      .is('deleted_at', null)

    // Format response
    const formattedPerson = {
      ...person,
      name: `${person.lastname} ${person.firstname}`.trim(),
      addresses: addresses || [],
      bank_accounts: bankAccounts || [],
      platform_mappings: platformMappings || [],
      relationships: relationships || []
    }

    return NextResponse.json({ person: formattedPerson })
  } catch (error) {
    console.error('Error in persons GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/persons/[id]
 * Update a person
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
      firstname,
      lastname,
      email,
      telephone,
      website,
      identifier,
      source,
      customer_group_id,
      is_active,
      tax_number,
      notes
    } = body

    // Validation
    if (!firstname || !firstname.trim()) {
      return NextResponse.json(
        { error: 'A keresztnév kötelező' },
        { status: 400 }
      )
    }

    if (!lastname || !lastname.trim()) {
      return NextResponse.json(
        { error: 'A vezetéknév kötelező' },
        { status: 400 }
      )
    }

    // Check if email already exists (excluding current record)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('customer_persons')
        .select('id')
        .eq('email', email.trim())
        .neq('id', id)
        .is('deleted_at', null)
        .single()

      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Már létezik személy ezzel az e-mail címmel' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
      website: website?.trim() || null,
      identifier: identifier?.trim() || null,
      customer_group_id: customer_group_id || null,
      is_active: is_active !== undefined ? is_active : true,
      tax_number: tax_number?.trim() || null,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString()
    }

    // Add optional fields if provided
    if (source !== undefined) updateData.source = source

    // Update person
    const { data, error } = await supabase
      .from('customer_persons')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error updating person:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a személy frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Személy nem található' },
        { status: 404 }
      )
    }

    // Format response
    const formattedPerson = {
      ...data,
      name: `${data.lastname} ${data.firstname}`.trim()
    }

    return NextResponse.json({ person: formattedPerson })
  } catch (error) {
    console.error('Error in persons PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/persons/[id]
 * Soft delete a person
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

    // Soft delete person
    const { error } = await supabase
      .from('customer_persons')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting person:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a személy törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in persons DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
