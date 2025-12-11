import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE - soft delete a linked accessory
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; accessoryId: string }> }
) {
  try {
    const { id: materialId, accessoryId } = await params

    const { error } = await supabaseServer
      .from('material_accessories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('material_id', materialId)
      .eq('accessory_id', accessoryId)
      .is('deleted_at', null)

    if (error) {
      console.error('Error soft deleting accessory link:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /materials/[id]/accessories/[accessoryId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

