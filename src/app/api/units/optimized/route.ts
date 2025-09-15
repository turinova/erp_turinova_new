import { NextRequest, NextResponse } from 'next/server'
import { optimizedQuery, PerformanceMonitor } from '@/lib/supabase-optimized'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all units (optimized)...')

    const units = await PerformanceMonitor.measureQuery(
      'units-get-all',
      () => optimizedQuery.getAllActive(
        'units',
        'id, name, shortform, created_at, updated_at, deleted_at',
        'name',
        'asc'
      )
    )

    console.log(`Fetched ${units.length} units successfully`)
    return NextResponse.json(units)

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
