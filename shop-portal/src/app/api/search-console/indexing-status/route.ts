import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/search-console/indexing-status
 * Get indexing status for multiple products
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

    // Fetch indexing statuses
    const { data: statuses, error: statusError } = await supabase
      .from('product_indexing_status')
      .select('product_id, is_indexed, last_checked, coverage_state')
      .in('product_id', productIds)

    if (statusError) {
      console.error('Error fetching indexing statuses:', statusError)
      return NextResponse.json({ 
        error: 'Failed to fetch indexing statuses' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      statuses: statuses || []
    })

  } catch (error) {
    console.error('Error in indexing status API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch indexing statuses'
    }, { status: 500 })
  }
}
