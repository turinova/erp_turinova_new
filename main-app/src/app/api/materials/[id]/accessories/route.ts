import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET linked accessories for a material
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseServer
      .from('material_accessories')
      .select(`
        material_id,
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
      .eq('material_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching material accessories:', error)
      return NextResponse.json({ error: 'Failed to fetch accessories' }, { status: 500 })
    }

    const formatted = (data || []).map((row: any) => ({
      material_id: row.material_id,
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

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error in GET /materials/[id]/accessories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST add accessory to material (revive soft-deleted if exists)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: materialId } = await params
    const body = await request.json()
    const accessoryId = body?.accessory_id as string | undefined

    if (!accessoryId) {
      return NextResponse.json({ error: 'accessory_id is required' }, { status: 400 })
    }

    // Check existing link
    const { data: existing, error: existingError } = await supabaseServer
      .from('material_accessories')
      .select('material_id, accessory_id, deleted_at')
      .eq('material_id', materialId)
      .eq('accessory_id', accessoryId)
      .maybeSingle()

    if (existingError) {
      console.error('Error checking existing link:', existingError)
      return NextResponse.json({ error: 'Failed to add accessory' }, { status: 500 })
    }

    if (existing && !existing.deleted_at) {
      return NextResponse.json({ error: 'Már hozzá van adva ez az élzáró' }, { status: 409 })
    }

    if (existing && existing.deleted_at) {
      // revive
      const { error: reviveError } = await supabaseServer
        .from('material_accessories')
        .update({ deleted_at: null, updated_at: new Date().toISOString() })
        .eq('material_id', materialId)
        .eq('accessory_id', accessoryId)

      if (reviveError) {
        console.error('Error reviving accessory link:', reviveError)
        return NextResponse.json({ error: 'Failed to add accessory' }, { status: 500 })
      }
      return NextResponse.json({ success: true, revived: true })
    }

    const { error: insertError } = await supabaseServer
      .from('material_accessories')
      .insert({
        material_id: materialId,
        accessory_id: accessoryId
      })

    if (insertError) {
      console.error('Error inserting accessory link:', insertError)
      return NextResponse.json({ error: 'Failed to add accessory' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /materials/[id]/accessories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

