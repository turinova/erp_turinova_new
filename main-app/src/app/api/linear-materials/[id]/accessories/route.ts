import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - Get all accessories linked to a linear material
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const accessories = await supabaseServer
      .from('linear_material_accessories')
      .select(`
        linear_material_id,
        accessory_id,
        created_at,
        updated_at,
        deleted_at,
        accessories (
          id,
          name,
          sku,
          base_price,
          partners_id,
          partners (
            id,
            name
          )
        )
      `)
      .eq('linear_material_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (accessories.error) {
      console.error('Error fetching linear material accessories:', accessories.error)
      return NextResponse.json({ error: 'Failed to fetch accessories' }, { status: 500 })
    }

    const transformed = (accessories.data || []).map((row: any) => ({
      linear_material_id: row.linear_material_id,
      accessory_id: row.accessory_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      accessory: {
        id: row.accessories?.id,
        name: row.accessories?.name,
        sku: row.accessories?.sku,
        base_price: row.accessories?.base_price,
        partners_id: row.accessories?.partners_id,
        partner_name: row.accessories?.partners?.name || ''
      }
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error in GET /api/linear-materials/[id]/accessories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add an accessory to a linear material
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { accessory_id } = body

    if (!accessory_id) {
      return NextResponse.json({ error: 'accessory_id is required' }, { status: 400 })
    }

    // Check if accessory exists and is not deleted
    const { data: accessory, error: accessoryError } = await supabaseServer
      .from('accessories')
      .select('id')
      .eq('id', accessory_id)
      .is('deleted_at', null)
      .single()

    if (accessoryError || !accessory) {
      return NextResponse.json({ error: 'Accessory not found' }, { status: 404 })
    }

    // Check if relationship already exists (including soft-deleted ones)
    const { data: existing } = await supabaseServer
      .from('linear_material_accessories')
      .select('deleted_at')
      .eq('linear_material_id', id)
      .eq('accessory_id', accessory_id)
      .maybeSingle()

    if (existing) {
      // If soft-deleted, restore it
      if (existing.deleted_at) {
        const { data: restored, error: restoreError } = await supabaseServer
          .from('linear_material_accessories')
          .update({ deleted_at: null })
          .eq('linear_material_id', id)
          .eq('accessory_id', accessory_id)
          .select()
          .single()

        if (restoreError) {
          console.error('Error restoring linear material accessory:', restoreError)
          return NextResponse.json({ error: 'Failed to restore accessory' }, { status: 500 })
        }

        return NextResponse.json(restored)
      } else {
        // Already exists and not deleted
        return NextResponse.json({ error: 'Accessory already linked to this linear material' }, { status: 400 })
      }
    }

    // Create new relationship
    const { data: newLink, error: insertError } = await supabaseServer
      .from('linear_material_accessories')
      .insert({
        linear_material_id: id,
        accessory_id: accessory_id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding linear material accessory:', insertError)
      return NextResponse.json({ error: 'Failed to add accessory' }, { status: 500 })
    }

    return NextResponse.json(newLink, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/linear-materials/[id]/accessories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

