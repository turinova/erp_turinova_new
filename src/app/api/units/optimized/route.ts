import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all units (optimized)...')
    
    const startTime = performance.now()
    
    const { data: units, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Units query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching units:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    console.log(`Fetched ${units?.length || 0} units successfully`)
    return NextResponse.json(units || [])

  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, shortform } = body

    if (!name || !shortform) {
      return NextResponse.json({ error: 'Name and shortform are required' }, { status: 400 })
    }

    console.log('Creating new unit (optimized)...')

    const newUnit = await PerformanceMonitor.measureQuery(
      'units-create',
      () => optimizedQuery.create('units', {
        name,
        shortform,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    )

    console.log('Unit created successfully:', newUnit)
    return NextResponse.json(newUnit, { status: 201 })

  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
