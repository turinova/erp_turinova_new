import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - List all units with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching units...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabaseServer
      .from('units')
      .select('id, name, shortform, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,shortform.ilike.%${searchQuery}%`)
    }
    
    const { data: units, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
    }

    console.log(`Fetched ${units?.length || 0} units successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(units || [])
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new unit
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new unit...')

    const unitData = await request.json()

    // Validate required fields
    if (!unitData.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const newUnit = {
      name: unitData.name || '',
      shortform: unitData.shortform || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: unit, error } = await supabaseServer
      .from('units')
      .insert([newUnit])
      .select('id, name, shortform, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy egység már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
    }

    console.log('Unit created successfully:', unit)

    return NextResponse.json(
      {
        success: true,
        message: 'Unit created successfully',
        data: unit
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
