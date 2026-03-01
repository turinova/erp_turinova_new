import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/tenant-supabase'

// GET /api/subscription/token-packs - Get available token packs
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = await getAdminSupabase()

    const { data: tokenPacks, error } = await adminSupabase
      .from('token_packs')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

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
    console.error('Error in GET /api/subscription/token-packs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token packs'
    }, { status: 500 })
  }
}
