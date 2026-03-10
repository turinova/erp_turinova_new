import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/warehouses
 * Fetch all warehouses
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') !== 'false'

    // Build query
    let query = supabase
      .from('warehouses')
      .select('id, name, code, is_active, created_at, updated_at')
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: warehouses, error } = await query

    if (error) {
      console.error('Error fetching warehouses:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a raktárak lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      warehouses: warehouses || []
    })
  } catch (error) {
    console.error('Error in warehouses GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/warehouses
 * Create a new warehouse
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, is_active = true } = body

    // Validation
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Név és kód kötelező' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('warehouses')
      .select('id')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ez a kód már létezik' },
        { status: 400 }
      )
    }

    // Insert new warehouse
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .insert({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating warehouse:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a raktár létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      warehouse
    }, { status: 201 })
  } catch (error) {
    console.error('Error in warehouses POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
