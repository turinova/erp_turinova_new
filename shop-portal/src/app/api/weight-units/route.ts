import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/weight-units
 * Fetch all active weight units from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active weight units
    const { data: weightUnits, error } = await supabase
      .from('weight_units')
      .select('id, name, shortform, shoprenter_weight_class_id, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching weight units:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a súlymértékek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ weightUnits: weightUnits || [] })
  } catch (error) {
    console.error('Error in weight-units API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/weight-units
 * Create a new weight unit
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
      .from('weight_units')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik súlymérték ezzel a névvel' },
        { status: 400 }
      )
    }

    // Check if shortform already exists
    const { data: existingByShortform } = await supabase
      .from('weight_units')
      .select('id')
      .eq('shortform', shortform.trim())
      .is('deleted_at', null)
      .single()

    if (existingByShortform) {
      return NextResponse.json(
        { error: 'Már létezik súlymérték ezzel a rövidítéssel' },
        { status: 400 }
      )
    }

    // Create weight unit
    const { data, error } = await supabase
      .from('weight_units')
      .insert({
        name: name.trim(),
        shortform: shortform.trim()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating weight unit:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a súlymérték létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ weightUnit: data }, { status: 201 })
  } catch (error) {
    console.error('Error in weight-units POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
