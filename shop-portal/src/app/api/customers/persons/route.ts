import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/persons
 * Fetch all active persons from the database
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
    const search = searchParams.get('search')?.trim() // Search by name, email, identifier
    const isActive = searchParams.get('is_active') // 'true' or 'false'

    // Build query
    let query = supabase
      .from('customer_persons')
      .select(`
        id,
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
        `firstname.ilike.%${search}%,lastname.ilike.%${search}%,email.ilike.%${search}%,identifier.ilike.%${search}%`
      )
    }

    // Order by lastname, firstname
    query = query.order('lastname', { ascending: true })
      .order('firstname', { ascending: true })

    const { data: persons, error } = await query

    if (error) {
      console.error('Error fetching persons:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a személyek lekérdezésekor' },
        { status: 500 }
      )
    }

    // Format response with full name
    const formattedPersons = (persons || []).map((person: any) => ({
      ...person,
      name: `${person.lastname} ${person.firstname}`.trim()
    }))

    return NextResponse.json({ persons: formattedPersons })
  } catch (error) {
    console.error('Error in persons API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/persons
 * Create a new person
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
      firstname,
      lastname,
      email,
      telephone,
      website,
      identifier,
      source = 'local',
      customer_group_id,
      is_active = true,
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

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('customer_persons')
        .select('id')
        .eq('email', email.trim())
        .is('deleted_at', null)
        .single()

      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Már létezik személy ezzel az e-mail címmel' },
          { status: 400 }
        )
      }
    }

    // Prepare insert data
    const insertData: any = {
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
      website: website?.trim() || null,
      identifier: identifier?.trim() || null,
      source: source || 'local',
      customer_group_id: customer_group_id || null,
      is_active: is_active !== false,
      tax_number: tax_number?.trim() || null,
      notes: notes?.trim() || null
    }

    // Create person
    const { data, error } = await supabase
      .from('customer_persons')
      .insert(insertData)
      .select(`
        *,
        customer_groups:customer_group_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error creating person:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a személy létrehozásakor' },
        { status: 500 }
      )
    }

    // Format response with full name
    const formattedPerson = {
      ...data,
      name: `${data.lastname} ${data.firstname}`.trim()
    }

    return NextResponse.json({ person: formattedPerson }, { status: 201 })
  } catch (error) {
    console.error('Error in persons POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
