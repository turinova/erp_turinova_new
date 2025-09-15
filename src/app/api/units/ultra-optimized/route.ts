import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'
import { withCache, cacheKeys, cacheTTL } from '@/lib/api-cache'

// Ultra-optimized units API with advanced caching
export async function GET(request: NextRequest) {
  try {
    const data = await withCache(
      cacheKeys.units(),
      async () => {
        console.log('Fetching units from database...')
        
        const { data: units, error } = await supabaseOptimized
          .from('units')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching units:', error)
          throw error
        }

        console.log(`Fetched ${units?.length || 0} units successfully`)
        return units || []
      },
      cacheTTL.medium // 5 minutes cache
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in ultra-optimized units API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
