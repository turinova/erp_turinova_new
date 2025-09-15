import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'
import { withCache, cacheKeys, cacheTTL } from '@/lib/api-cache'

// Ultra-optimized admin check API with advanced caching
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    const isAdmin = await withCache(
      cacheKeys.adminCheck(userId),
      async () => {
        console.log(`Checking admin status for user: ${userId}`)
        
        // Single optimized query to check admin status
        const { data: adminPermission, error } = await supabaseOptimized
          .from('user_permissions')
          .select(`
            can_edit,
            pages!inner(
              id,
              path
            )
          `)
          .eq('user_id', userId)
          .eq('pages.path', '/users')
          .eq('can_edit', true)
          .single()

        if (error) {
          console.error('Error checking admin status:', error)
          return false
        }

        const result = adminPermission?.can_edit === true
        console.log(`Admin check result for ${userId}: ${result}`)
        return result
      },
      cacheTTL.long // 15 minutes cache (admin status rarely changes)
    )

    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error('Error in ultra-optimized admin check API:', error)
    return NextResponse.json({ isAdmin: false })
  }
}
