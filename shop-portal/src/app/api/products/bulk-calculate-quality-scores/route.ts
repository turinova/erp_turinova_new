import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { calculateBulkProductScores } from '@/lib/product-quality-service'

/**
 * POST /api/products/bulk-calculate-quality-scores
 * Calculate quality scores for multiple products
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

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
