import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/manufacturers
 * Fetch all active manufacturers from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active manufacturers
    const { data: manufacturers, error } = await supabase
      .from('manufacturers')
      .select('id, name, description, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching manufacturers:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a gyártók lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ manufacturers: manufacturers || [] })
  } catch (error) {
    console.error('Error in manufacturers API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/manufacturers
 * Create a new manufacturer
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
    const { name, description } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A gyártó neve kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik gyártó ezzel a névvel' },
        { status: 400 }
      )
    }

    // Create manufacturer
    const { data, error } = await supabase
      .from('manufacturers')
      .insert({
        name: name.trim(),
        description: description?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating manufacturer:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a gyártó létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ manufacturer: data }, { status: 201 })
  } catch (error) {
    console.error('Error in manufacturers POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
