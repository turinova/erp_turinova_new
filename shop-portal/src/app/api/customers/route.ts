import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers
 * Fetch all active customers (persons and companies) from the database
 * Supports filtering by entity_type, source, and search
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
    const entityType = searchParams.get('entity_type') // 'person' or 'company'
    const source = searchParams.get('source') // 'local' or 'webshop_sync'
    const search = searchParams.get('search')?.trim() // Search by name, email, identifier
    const isActive = searchParams.get('is_active') // 'true' or 'false'

    // Build query
    let query = supabase
      .from('customer_entities')
      .select(`
        id,
        entity_type,
        name,
        email,
        telephone,
        website,
        identifier,
        source,
        customer_group_id,
        is_active,
        firstname,
        lastname,
        tax_number,
        eu_tax_number,
        created_at,
        updated_at,
        customer_groups:customer_group_id(id, name)
      `)
      .is('deleted_at', null)

    // Apply filters
    if (entityType && (entityType === 'person' || entityType === 'company')) {
      query = query.eq('entity_type', entityType)
    }

    if (source && (source === 'local' || source === 'webshop_sync')) {
      query = query.eq('source', source)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Apply search
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,identifier.ilike.%${search}%,firstname.ilike.%${search}%,lastname.ilike.%${search}%`
      )
    }

    // Order by name
    query = query.order('name', { ascending: true })

    const { data: customers, error } = await query

    if (error) {
      console.error('Error fetching customers:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevők lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ customers: customers || [] })
  } catch (error) {
    console.error('Error in customers API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers
 * Create a new customer (person or company)
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
      entity_type = 'person', // 'person' or 'company'
      name,
      email,
      telephone,
      website,
      identifier,
      source = 'local', // 'local' or 'webshop_sync'
      customer_group_id,
      is_active = true,
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

    if (entity_type !== 'person' && entity_type !== 'company') {
      return NextResponse.json(
        { error: 'Érvénytelen entitás típus. Használjon "person" vagy "company" értéket.' },
        { status: 400 }
      )
    }

    // For persons, validate firstname and lastname
    if (entity_type === 'person') {
      if (!firstname || !firstname.trim()) {
        return NextResponse.json(
          { error: 'A keresztnév kötelező személyeknél' },
          { status: 400 }
        )
      }
      if (!lastname || !lastname.trim()) {
        return NextResponse.json(
          { error: 'A vezetéknév kötelező személyeknél' },
          { status: 400 }
        )
      }
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('customer_entities')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik vevő ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('customer_entities')
        .select('id')
        .eq('email', email.trim())
        .is('deleted_at', null)
        .single()

      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Már létezik vevő ezzel az e-mail címmel' },
          { status: 400 }
        )
      }
    }

    // Prepare data based on entity type
    const insertData: any = {
      entity_type,
      name: name.trim(),
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
      website: website?.trim() || null,
      identifier: identifier?.trim() || null,
      source: source || 'local',
      customer_group_id: customer_group_id || null,
      is_active: is_active !== false,
      notes: notes?.trim() || null
    }

    // Add person-specific fields
    if (entity_type === 'person') {
      insertData.firstname = firstname?.trim() || null
      insertData.lastname = lastname?.trim() || null
    }

    // Add company-specific fields
    if (entity_type === 'company') {
      insertData.tax_number = tax_number?.trim() || null
      insertData.eu_tax_number = eu_tax_number?.trim() || null
      insertData.group_tax_number = group_tax_number?.trim() || null
      insertData.company_registration_number = company_registration_number?.trim() || null
    }

    // Create customer
    const { data, error } = await supabase
      .from('customer_entities')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevő létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ customer: data }, { status: 201 })
  } catch (error) {
    console.error('Error in customers POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
