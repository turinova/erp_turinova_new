import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/products/[id]/search-console
 * Get Search Console data for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
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

    // Get URL params for date range
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get performance data
    const { data: performance, error: perfError } = await supabase
      .from('product_search_performance')
      .select('*')
      .eq('product_id', productId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    // Get top queries
    const { data: queries, error: queriesError } = await supabase
      .from('product_search_queries')
      .select('*')
      .eq('product_id', productId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('clicks', { ascending: false })
      .limit(20)

    // Get indexing status (with enhanced fields)
    const { data: indexingStatus, error: indexingError } = await supabase
      .from('product_indexing_status')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle()

    // Calculate aggregated stats
    const totalImpressions = performance?.reduce((sum, p) => sum + (p.impressions || 0), 0) || 0
    const totalClicks = performance?.reduce((sum, p) => sum + (p.clicks || 0), 0) || 0
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
    const avgPosition = performance && performance.length > 0
      ? performance.reduce((sum, p) => sum + (p.position || 0), 0) / performance.length
      : 0

    return NextResponse.json({
      success: true,
      performance: performance || [],
      queries: queries || [],
      indexingStatus: indexingStatus || null,
      stats: {
        totalImpressions,
        totalClicks,
        avgCtr,
        avgPosition,
        uniqueQueries: queries?.length || 0
      }
    })

  } catch (error) {
    console.error('Error fetching Search Console data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Search Console data'
    }, { status: 500 })
  }
}
