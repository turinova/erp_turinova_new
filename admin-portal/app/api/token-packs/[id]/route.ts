import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/token-packs/[id] - Get token pack by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: tokenPack, error } = await supabase
      .from('token_packs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching token pack:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tokenPack
    })

  } catch (error) {
    console.error('Error in GET /api/token-packs/[id]:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token pack'
    }, { status: 500 })
  }
}

// PUT /api/token-packs/[id] - Update token pack
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, credits, price_huf, is_active, display_order } = body

    const supabase = createAdminClient()

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (credits !== undefined) updateData.credits = parseInt(credits)
    if (price_huf !== undefined) updateData.price_huf = parseInt(price_huf)
    if (is_active !== undefined) updateData.is_active = is_active
    if (display_order !== undefined) updateData.display_order = parseInt(display_order)

    const { data: tokenPack, error } = await supabase
      .from('token_packs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating token pack:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tokenPack
    })

  } catch (error) {
    console.error('Error in PUT /api/token-packs/[id]:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update token pack'
    }, { status: 500 })
  }
}

// DELETE /api/token-packs/[id] - Delete token pack
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('token_packs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting token pack:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Error in DELETE /api/token-packs/[id]:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete token pack'
    }, { status: 500 })
  }
}
