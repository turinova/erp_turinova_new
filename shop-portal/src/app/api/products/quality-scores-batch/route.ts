import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/products/quality-scores-batch
 * Get quality scores for multiple products in one request
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get request body
    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs are required' }, { status: 400 })
    }

    // Limit to 200 products per request
    if (productIds.length > 200) {
      return NextResponse.json({ 
        error: 'Maximum 200 products per request' 
      }, { status: 400 })
    }

    // Fetch quality scores in batch
    const { data: scores, error: scoresError } = await supabase
      .from('product_quality_scores')
      .select('product_id, overall_score, content_score, image_score, technical_score, performance_score, completeness_score, competitive_score, priority_score, is_parent, blocking_issues, issues, last_calculated_at')
      .in('product_id', productIds)

    if (scoresError) {
      console.error('Error fetching quality scores:', scoresError)
      return NextResponse.json({ 
        error: 'Failed to fetch quality scores' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      scores: scores || []
    })

  } catch (error) {
    console.error('Error in quality scores batch API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch quality scores'
    }, { status: 500 })
  }
}
