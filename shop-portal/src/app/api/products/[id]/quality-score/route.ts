import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { calculateAndStoreProductScore } from '@/lib/product-quality-service'

/**
 * GET /api/products/[id]/quality-score
 * Get quality score for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params

  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get stored score
    const { data: score, error: scoreError } = await supabase
      .from('product_quality_scores')
      .select('*')
      .eq('product_id', productId)
      .single()

    if (scoreError && scoreError.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      console.error('Error fetching score:', scoreError)
    }

    return NextResponse.json({
      success: true,
      score: score || null
    })
  } catch (error) {
    console.error('Error in GET /api/products/[id]/quality-score:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch quality score'
    }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/quality-score
 * Calculate and store quality score for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params

  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const scoreResult = await calculateAndStoreProductScore(supabase, productId)

    if (!scoreResult) {
      return NextResponse.json({
        success: false,
        error: 'Failed to calculate quality score'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      score: scoreResult
    })
  } catch (error) {
    console.error('Error in POST /api/products/[id]/quality-score:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate quality score'
    }, { status: 500 })
  }
}
