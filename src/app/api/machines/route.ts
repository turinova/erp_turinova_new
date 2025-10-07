import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - List all machines with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching machines...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabaseServer
      .from('production_machines')
      .select('id, machine_name, comment, usage_limit_per_day, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.ilike('machine_name', `%${searchQuery}%`)
    }
    
    const { data: machines, error } = await query.order('machine_name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch machines' }, { status: 500 })
    }

    console.log(`Fetched ${machines?.length || 0} machines successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(machines || [])
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error) {
    console.error('Error fetching machines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new machine
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new machine...')

    const machineData = await request.json()

    // Validate required fields
    if (!machineData.machine_name) {
      return NextResponse.json({ error: 'Machine name is required' }, { status: 400 })
    }

    if (!machineData.usage_limit_per_day) {
      return NextResponse.json({ error: 'Usage limit per day is required' }, { status: 400 })
    }

    const newMachine = {
      machine_name: machineData.machine_name || '',
      comment: machineData.comment || null,
      usage_limit_per_day: machineData.usage_limit_per_day || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: machine, error } = await supabaseServer
      .from('production_machines')
      .insert([newMachine])
      .select('id, machine_name, comment, usage_limit_per_day, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('machine_name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy gép már létezik ezzel a névvel',
            error: 'Machine name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to create machine' }, { status: 500 })
    }

    console.log('Machine created successfully:', machine)

    return NextResponse.json(
      {
        success: true,
        message: 'Machine created successfully',
        data: machine
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
