import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/manufacturers/[id]
 * Update a manufacturer
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
    const { name, description } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A gyártó neve kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik gyártó ezzel a névvel' },
        { status: 400 }
      )
    }

    // Update manufacturer
    const { data, error } = await supabase
      .from('manufacturers')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating manufacturer:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a gyártó frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Gyártó nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ manufacturer: data })
  } catch (error) {
    console.error('Error in manufacturers PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/manufacturers/[id]
 * Soft delete a manufacturer
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

    // Soft delete manufacturer
    const { error } = await supabase
      .from('manufacturers')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting manufacturer:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a gyártó törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in manufacturers DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
