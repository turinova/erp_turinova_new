import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/companies/[id]
 * Fetch a single company with all related data
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

    // Fetch company with related data
    const { data: company, error: companyError } = await supabase
      .from('customer_companies')
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
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
    const { data: addresses } = await supabase
      .from('customer_addresses')
      .select('*')
      .or(`company_id.eq.${id},customer_entity_id.eq.${id}`)
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
      .or(`company_id.eq.${id},customer_entity_id.eq.${id}`)
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
      .eq('company_id', id)

    // Fetch relationships (persons linked to this company)
    const { data: relationships } = await supabase
      .from('customer_person_company_relationships')
      .select(`
        *,
        persons:person_id(id, firstname, lastname, email, telephone)
      `)
      .eq('company_id', id)
      .is('deleted_at', null)

    return NextResponse.json({
      company: {
        ...company,
        addresses: addresses || [],
        bank_accounts: bankAccounts || [],
        platform_mappings: platformMappings || [],
        relationships: relationships || []
      }
    })
  } catch (error) {
    console.error('Error in companies GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/companies/[id]
 * Update a company
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
      name,
      email,
      telephone,
      website,
      identifier,
      source,
      customer_group_id,
      is_active,
      tax_number,
      eu_tax_number,
      group_tax_number,
      company_registration_number,
      notes
    } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A cég neve kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('customer_companies')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik cég ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if email already exists (if provided and changed)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('customer_companies')
        .select('id')
        .eq('email', email.trim())
        .neq('id', id)
        .is('deleted_at', null)
        .single()

      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Már létezik cég ezzel az e-mail címmel' },
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
      is_active: is_active !== undefined ? is_active : true,
      tax_number: tax_number?.trim() || null,
      eu_tax_number: eu_tax_number?.trim() || null,
      group_tax_number: group_tax_number?.trim() || null,
      company_registration_number: company_registration_number?.trim() || null,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString()
    }

    // Add optional fields if provided
    if (source !== undefined) updateData.source = source

    // Update company
    const { data, error } = await supabase
      .from('customer_companies')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error updating company:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cég frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cég nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ company: data })
  } catch (error) {
    console.error('Error in companies PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/companies/[id]
 * Soft delete a company
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

    // Soft delete company
    const { error } = await supabase
      .from('customer_companies')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting company:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cég törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in companies DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
