import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/token-packs - Get all token packs
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'

    let query = supabase
      .from('token_packs')
      .select('*')
      .order('display_order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: tokenPacks, error } = await query

    if (error) {
      console.error('Error fetching token packs:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tokenPacks: tokenPacks || []
    })

  } catch (error) {
    console.error('Error in GET /api/token-packs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token packs'
    }, { status: 500 })
  }
}

// POST /api/token-packs - Create new token pack
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, credits, price_huf, is_active = true, display_order = 0 } = body

    if (!name || !credits || !price_huf) {
      return NextResponse.json(
        { success: false, error: 'Name, credits, and price_huf are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: tokenPack, error } = await supabase
      .from('token_packs')
      .insert({
        name,
        credits: parseInt(credits),
        price_huf: parseInt(price_huf),
        is_active,
        display_order: parseInt(display_order)
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating token pack:', error)
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
    console.error('Error in POST /api/token-packs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create token pack'
    }, { status: 500 })
  }
}
