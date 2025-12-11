import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE - Soft delete an accessory from a linear material
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accessoryId: string }> }
) {
  try {
    const { id, accessoryId } = await params

    // Check if relationship exists
    const { data: existing, error: fetchError } = await supabaseServer
      .from('linear_material_accessories')
      .select('deleted_at')
      .eq('linear_material_id', id)
      .eq('accessory_id', accessoryId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Relationship not found' }, { status: 404 })
    }

    if (existing.deleted_at) {
      return NextResponse.json({ error: 'Relationship already deleted' }, { status: 400 })
    }

    // Soft delete
    const { error: deleteError } = await supabaseServer
      .from('linear_material_accessories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('linear_material_id', id)
      .eq('accessory_id', accessoryId)

    if (deleteError) {
      console.error('Error soft deleting linear material accessory:', deleteError)
      return NextResponse.json({ error: 'Failed to delete accessory' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Accessory removed successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/linear-materials/[id]/accessories/[accessoryId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

