import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/persons/[id]/relationships
 * Fetch all company relationships for a person
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

    // Verify person exists
    const { data: person, error: personError } = await supabase
      .from('customer_persons')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Személy nem található' },
        { status: 404 }
      )
    }

    // Fetch relationships
    const { data: relationships, error } = await supabase
      .from('customer_person_company_relationships')
      .select(`
        *,
        companies:company_id(
          id,
          name,
          email,
          telephone,
          website,
          tax_number,
          is_active
        )
      `)
      .eq('person_id', id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching person relationships:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolatok lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      relationships: relationships || []
    })
  } catch (error) {
    console.error('Error in person relationships GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/persons/[id]/relationships
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

    // Verify person exists
    const { data: person, error: personError } = await supabase
      .from('customer_persons')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Személy nem található' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      company_id,
      role = 'contact_person',
      is_primary = false,
      notes
    } = body

    // Validation
    if (!company_id) {
      return NextResponse.json(
        { error: 'A cég azonosító kötelező' },
        { status: 400 }
      )
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('customer_companies')
      .select('id')
      .eq('id', company_id)
      .is('deleted_at', null)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Cég nem található' },
        { status: 404 }
      )
    }

    // Check if relationship already exists
    const { data: existingRelationship } = await supabase
      .from('customer_person_company_relationships')
      .select('id')
      .eq('person_id', id)
      .eq('company_id', company_id)
      .is('deleted_at', null)
      .single()

    if (existingRelationship) {
      return NextResponse.json(
        { error: 'Ez a kapcsolat már létezik' },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primary relationships for this person
    if (is_primary) {
      await supabase
        .from('customer_person_company_relationships')
        .update({ is_primary: false })
        .eq('person_id', id)
        .is('deleted_at', null)
    }

    // Create relationship
    const { data, error } = await supabase
      .from('customer_person_company_relationships')
      .insert({
        person_id: id,
        company_id: company_id,
        role: role || 'contact_person',
        is_primary: is_primary || false,
        notes: notes?.trim() || null
      })
      .select(`
        *,
        companies:company_id(
          id,
          name,
          email,
          telephone,
          website,
          tax_number,
          is_active
        )
      `)
      .single()

    if (error) {
      console.error('Error creating person relationship:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ relationship: data }, { status: 201 })
  } catch (error) {
    console.error('Error in person relationships POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
