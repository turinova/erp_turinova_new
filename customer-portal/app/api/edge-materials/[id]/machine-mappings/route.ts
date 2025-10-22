import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch machine mappings for a specific edge material
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params


    const { data, error } = await supabase
      .from('machine_edge_material_map')
      .select(`
        id,
        machine_code,
        machine_type,
        created_at
      `)
      .eq('edge_material_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching edge material machine mappings:', error)
      return NextResponse.json({ error: 'Failed to fetch machine mappings' }, { status: 500 })
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Error in GET edge material machine mappings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new machine mapping for an edge material
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { machine_code, machine_type = 'Korpus' } = body

    if (!machine_code) {
      return NextResponse.json({ error: 'Machine code is required' }, { status: 400 })
    }


    const { data, error } = await supabase
      .from('machine_edge_material_map')
      .insert({
        edge_material_id: id,
        machine_code,
        machine_type
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating edge material machine mapping:', error)
      return NextResponse.json({ error: 'Failed to create machine mapping' }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in POST edge material machine mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update an existing machine mapping for an edge material
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { mappingId, machine_code, machine_type = 'Korpus' } = body

    if (!mappingId || !machine_code) {
      return NextResponse.json({ error: 'Mapping ID and machine code are required' }, { status: 400 })
    }


    const { data, error } = await supabase
      .from('machine_edge_material_map')
      .update({
        machine_code,
        machine_type,
      })
      .eq('id', mappingId)
      .eq('edge_material_id', id) // Ensure mapping belongs to this edge material
      .select()
      .single()

    if (error) {
      console.error('Error updating edge material machine mapping:', error)
      return NextResponse.json({ error: 'Failed to update machine mapping' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })

  } catch (error) {
    console.error('Error in PUT edge material machine mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a machine mapping for an edge material
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const mappingId = searchParams.get('mappingId')

    if (!mappingId) {
      return NextResponse.json({ error: 'Mapping ID is required' }, { status: 400 })
    }


    const { error } = await supabase
      .from('machine_edge_material_map')
      .delete()
      .eq('id', mappingId)
      .eq('edge_material_id', id)

    if (error) {
      console.error('Error deleting edge material machine mapping:', error)
      return NextResponse.json({ error: 'Failed to delete machine mapping' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE edge material machine mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
