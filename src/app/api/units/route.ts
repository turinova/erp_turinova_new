import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all units...')

    // Single optimized query with all columns
    const { data: units, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at, deleted_at')
      .is('deleted_at', null) // Only fetch active records
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
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
    console.log('Creating new unit...')

    const unitData = await request.json()

    const newUnit = {
      name: unitData.name || '',
      shortform: unitData.shortform || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: unit, error } = await supabase
      .from('units')
      .insert([newUnit])
      .select()
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
        unit: unit
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
