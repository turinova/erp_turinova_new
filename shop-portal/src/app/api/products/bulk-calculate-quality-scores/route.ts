import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { calculateBulkProductScores } from '@/lib/product-quality-service'

/**
 * POST /api/products/bulk-calculate-quality-scores
 * Calculate quality scores for multiple products
 */
export async function POST(request: NextRequest) {
  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs required' }, { status: 400 })
    }

    // Limit to 100 products at a time
    if (productIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 products at a time' }, { status: 400 })
    }

    const results = await calculateBulkProductScores(supabase, productIds)

    return NextResponse.json({
      success: true,
      ...results
    })
  } catch (error) {
    console.error('Error in POST /api/products/bulk-calculate-quality-scores:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate quality scores'
    }, { status: 500 })
  }
}
