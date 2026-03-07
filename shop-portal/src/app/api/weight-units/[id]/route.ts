import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/weight-units/[id]
 * Update a weight unit
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
      .from('weight_units')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik súlymérték ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if shortform already exists (excluding current record)
    const { data: existingByShortform } = await supabase
      .from('weight_units')
      .select('id')
      .eq('shortform', shortform.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByShortform) {
      return NextResponse.json(
        { error: 'Már létezik súlymérték ezzel a rövidítéssel' },
        { status: 400 }
      )
    }

    // Update weight unit
    const { data, error } = await supabase
      .from('weight_units')
      .update({
        name: name.trim(),
        shortform: shortform.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating weight unit:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a súlymérték frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Súlymérték nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ weightUnit: data })
  } catch (error) {
    console.error('Error in weight-units PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/weight-units/[id]
 * Soft delete a weight unit
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

    // Soft delete weight unit
    const { error } = await supabase
      .from('weight_units')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting weight unit:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a súlymérték törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in weight-units DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
