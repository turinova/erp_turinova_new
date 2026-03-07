import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/units/[id]
 * Update a measurement unit
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
    const { name, shortform } = body

    // Validation
    if (!name || !shortform) {
      return NextResponse.json(
        { error: 'Név és rövidítés megadása kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('units')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik mértékegység ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if shortform already exists (excluding current record)
    const { data: existingByShortform } = await supabase
      .from('units')
      .select('id')
      .eq('shortform', shortform.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByShortform) {
      return NextResponse.json(
        { error: 'Már létezik mértékegység ezzel a rövidítéssel' },
        { status: 400 }
      )
    }

    // Update unit
    const { data, error } = await supabase
      .from('units')
      .update({
        name: name.trim(),
        shortform: shortform.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating unit:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a mértékegység frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Mértékegység nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ unit: data })
  } catch (error) {
    console.error('Error in units PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/units/[id]
 * Soft delete a measurement unit
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

    // Soft delete unit
    const { error } = await supabase
      .from('units')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting unit:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a mértékegység törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in units DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
