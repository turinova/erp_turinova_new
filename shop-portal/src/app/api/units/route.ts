import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/units
 * Fetch all active measurement units from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active units
    const { data: units, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching units:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a mértékegységek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ units: units || [] })
  } catch (error) {
    console.error('Error in units API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/units
 * Create a new measurement unit
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
    const { name, shortform } = body

    // Validation
    if (!name || !shortform) {
      return NextResponse.json(
        { error: 'Név és rövidítés megadása kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from('units')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik mértékegység ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if shortform already exists
    const { data: existingByShortform } = await supabase
      .from('units')
      .select('id')
      .eq('shortform', shortform.trim())
      .is('deleted_at', null)
      .single()

    if (existingByShortform) {
      return NextResponse.json(
        { error: 'Már létezik mértékegység ezzel a rövidítéssel' },
        { status: 400 }
      )
    }

    // Create unit
    const { data, error } = await supabase
      .from('units')
      .insert({
        name: name.trim(),
        shortform: shortform.trim()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating unit:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a mértékegység létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ unit: data }, { status: 201 })
  } catch (error) {
    console.error('Error in units POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
