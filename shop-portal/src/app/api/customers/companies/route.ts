import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/companies
 * Fetch all active companies from the database
 * Supports filtering by source, search, and is_active
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') // 'local' or 'webshop_sync'
    const search = searchParams.get('search')?.trim() // Search by name, email, identifier, tax_number
    const isActive = searchParams.get('is_active') // 'true' or 'false'

    // Build query
    let query = supabase
      .from('customer_companies')
      .select(`
        id,
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
        notes,
        created_at,
        updated_at,
        customer_groups:customer_group_id(id, name)
      `)
      .is('deleted_at', null)

    // Apply filters
    if (source && (source === 'local' || source === 'webshop_sync')) {
      query = query.eq('source', source)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Apply search
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,identifier.ilike.%${search}%,tax_number.ilike.%${search}%`
      )
    }

    // Order by name
    query = query.order('name', { ascending: true })

    const { data: companies, error } = await query

    if (error) {
      console.error('Error fetching companies:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cégek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ companies: companies || [] })
  } catch (error) {
    console.error('Error in companies API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/companies
 * Create a new company
 */
export async function POST(request: NextRequest) {
  try {
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
      source = 'local',
      customer_group_id,
      is_active = true,
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

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('customer_companies')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik cég ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('customer_companies')
        .select('id')
        .eq('email', email.trim())
        .is('deleted_at', null)
        .single()

      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Már létezik cég ezzel az e-mail címmel' },
          { status: 400 }
        )
      }
    }

    // Prepare insert data
    const insertData: any = {
      name: name.trim(),
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
      website: website?.trim() || null,
      identifier: identifier?.trim() || null,
      source: source || 'local',
      customer_group_id: customer_group_id || null,
      is_active: is_active !== false,
      tax_number: tax_number?.trim() || null,
      eu_tax_number: eu_tax_number?.trim() || null,
      group_tax_number: group_tax_number?.trim() || null,
      company_registration_number: company_registration_number?.trim() || null,
      notes: notes?.trim() || null
    }

    // Create company
    const { data, error } = await supabase
      .from('customer_companies')
      .insert(insertData)
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error creating company:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a cég létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ company: data }, { status: 201 })
  } catch (error) {
    console.error('Error in companies POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
