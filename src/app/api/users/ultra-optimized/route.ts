import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'
import { withCache, cacheKeys, cacheTTL } from '@/lib/api-cache'

// Ultra-optimized users API with advanced caching
export async function GET(request: NextRequest) {
  try {
    const data = await withCache(
      cacheKeys.users(),
      async () => {
        console.log('Fetching users from database...')
        
        const { data: users, error } = await supabaseOptimized.auth.admin.listUsers({
          page: 1,
          perPage: 1000 // Get all users in one query
        })

        if (error) {
          console.error('Error fetching users:', error)
          throw error
        }

        // Transform users to match our interface
        const transformedUsers = users.users.map(user => ({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || '',
          phone: user.user_metadata?.phone || '',
          role: user.user_metadata?.role || 'user',
          is_active: !!user.email_confirmed_at,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_sign_in_at: user.last_sign_in_at
        }))

        console.log(`Fetched ${transformedUsers.length} users successfully`)
        return transformedUsers
      },
      cacheTTL.medium // 5 minutes cache
    )

    return NextResponse.json({ users: data })
  } catch (error) {
    console.error('Error in ultra-optimized users API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
