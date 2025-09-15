import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'
import { withCache, cacheKeys, cacheTTL } from '@/lib/api-cache'

// Ultra-optimized brands API with advanced caching
export async function GET(request: NextRequest) {
  try {
    const data = await withCache(
      cacheKeys.brands(),
      async () => {
        console.log('Fetching brands from database...')
        
        const { data: brands, error } = await supabaseOptimized
          .from('brands')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching brands:', error)
          throw error
        }

        console.log(`Fetched ${brands?.length || 0} brands successfully`)
        return brands || []
      },
      cacheTTL.medium // 5 minutes cache
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in ultra-optimized brands API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
