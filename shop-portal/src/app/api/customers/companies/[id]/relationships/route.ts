import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/companies/[id]/relationships
 * Fetch all person relationships for a company
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

    // Fetch relationships
    const { data: relationships, error } = await supabase
      .from('customer_person_company_relationships')
      .select(`
        *,
        persons:person_id(
          id,
          firstname,
          lastname,
          email,
          telephone,
          is_active
        )
      `)
      .eq('company_id', id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching company relationships:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolatok lekérdezésekor' },
        { status: 500 }
      )
    }

    // Format response with full person names
    const formattedRelationships = (relationships || []).map((rel: any) => ({
      ...rel,
      person: rel.persons ? {
        ...rel.persons,
        name: `${rel.persons.lastname} ${rel.persons.firstname}`.trim()
      } : null
    }))

    return NextResponse.json({
      relationships: formattedRelationships
    })
  } catch (error) {
    console.error('Error in company relationships GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/companies/[id]/relationships
 * Link a person to a company
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
      person_id,
      role = 'contact_person',
      is_primary = false,
      notes
    } = body

    // Validation
    if (!person_id) {
      return NextResponse.json(
        { error: 'A személy azonosító kötelező' },
        { status: 400 }
      )
    }

    // Verify person exists
    const { data: person, error: personError } = await supabase
      .from('customer_persons')
      .select('id')
      .eq('id', person_id)
      .is('deleted_at', null)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Személy nem található' },
        { status: 404 }
      )
    }

    // Check if relationship already exists
    const { data: existingRelationship } = await supabase
      .from('customer_person_company_relationships')
      .select('id')
      .eq('person_id', person_id)
      .eq('company_id', id)
      .is('deleted_at', null)
      .single()

    if (existingRelationship) {
      return NextResponse.json(
        { error: 'Ez a kapcsolat már létezik' },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primary relationships for this company
    if (is_primary) {
      await supabase
        .from('customer_person_company_relationships')
        .update({ is_primary: false })
        .eq('company_id', id)
        .is('deleted_at', null)
    }

    // Create relationship
    const { data, error } = await supabase
      .from('customer_person_company_relationships')
      .insert({
        person_id: person_id,
        company_id: id,
        role: role || 'contact_person',
        is_primary: is_primary || false,
        notes: notes?.trim() || null
      })
      .select(`
        *,
        persons:person_id(
          id,
          firstname,
          lastname,
          email,
          telephone,
          is_active
        )
      `)
      .single()

    if (error) {
      console.error('Error creating company relationship:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat létrehozásakor' },
        { status: 500 }
      )
    }

    // Format response
    const formattedRelationship = {
      ...data,
      person: data.persons ? {
        ...data.persons,
        name: `${data.persons.lastname} ${data.persons.firstname}`.trim()
      } : null
    }

    return NextResponse.json({ relationship: formattedRelationship }, { status: 201 })
  } catch (error) {
    console.error('Error in company relationships POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
