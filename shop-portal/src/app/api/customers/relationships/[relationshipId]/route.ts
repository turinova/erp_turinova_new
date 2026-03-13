import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/customers/relationships/[relationshipId]
 * Update a person-company relationship
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> }
) {
  try {
    const { relationshipId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      role,
      is_primary,
      notes
    } = body

    // Get current relationship to check if we need to unset other primaries
    const { data: currentRelationship, error: currentError } = await supabase
      .from('customer_person_company_relationships')
      .select('person_id, company_id, is_primary')
      .eq('id', relationshipId)
      .is('deleted_at', null)
      .single()

    if (currentError || !currentRelationship) {
      return NextResponse.json(
        { error: 'Kapcsolat nem található' },
        { status: 404 }
      )
    }

    // If setting as primary, unset other primary relationships
    if (is_primary === true && !currentRelationship.is_primary) {
      // Unset primary for person's other relationships
      await supabase
        .from('customer_person_company_relationships')
        .update({ is_primary: false })
        .eq('person_id', currentRelationship.person_id)
        .neq('id', relationshipId)
        .is('deleted_at', null)

      // Unset primary for company's other relationships
      await supabase
        .from('customer_person_company_relationships')
        .update({ is_primary: false })
        .eq('company_id', currentRelationship.company_id)
        .neq('id', relationshipId)
        .is('deleted_at', null)
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (role !== undefined) updateData.role = role
    if (is_primary !== undefined) updateData.is_primary = is_primary
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    // Update relationship
    const { data, error } = await supabase
      .from('customer_person_company_relationships')
      .update(updateData)
      .eq('id', relationshipId)
      .select(`
        *,
        persons:person_id(
          id,
          firstname,
          lastname,
          email,
          telephone,
          is_active
        ),
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
      console.error('Error updating relationship:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat frissítésekor' },
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

    return NextResponse.json({ relationship: formattedRelationship })
  } catch (error) {
    console.error('Error in relationships PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/relationships/[relationshipId]
 * Soft delete a person-company relationship
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> }
) {
  try {
    const { relationshipId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete relationship
    const { error } = await supabase
      .from('customer_person_company_relationships')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', relationshipId)

    if (error) {
      console.error('Error deleting relationship:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in relationships DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
