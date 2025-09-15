import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'
import { withCache, cacheKeys, cacheTTL } from '@/lib/api-cache'

// Ultra-optimized customers API with advanced caching
export async function GET(request: NextRequest) {
  try {
    const data = await withCache(
      cacheKeys.customers(),
      async () => {
        console.log('Fetching customers from database...')
        
        const { data: customers, error } = await supabaseOptimized
          .from('customers')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching customers:', error)
          throw error
        }

        console.log(`Fetched ${customers?.length || 0} customers successfully`)
        return customers || []
      },
      cacheTTL.medium // 5 minutes cache
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in ultra-optimized customers API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
