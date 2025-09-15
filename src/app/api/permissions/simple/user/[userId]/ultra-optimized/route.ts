import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'
import { withCache, cacheKeys, cacheTTL } from '@/lib/api-cache'

// Ultra-optimized user permissions API with advanced caching
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    const permissions = await withCache(
      cacheKeys.permissions(userId),
      async () => {
        console.log(`Fetching permissions for user: ${userId}`)
        
        // Single optimized query to get all user permissions
        const { data: userPermissions, error } = await supabaseOptimized
          .from('user_permissions')
          .select(`
            can_access,
            pages!inner(
              id,
              path,
              name
            )
          `)
          .eq('user_id', userId)

        if (error) {
          console.error('Error fetching user permissions:', error)
          return []
        }

        // Transform the data to match expected format
        const transformedPermissions = userPermissions?.map((permission: any) => ({
          page_path: permission.pages.path,
          page_name: permission.pages.name,
          can_access: permission.can_access
        })) || []

        console.log(`Fetched ${transformedPermissions.length} permissions for user ${userId}`)
        return transformedPermissions
      },
      cacheTTL.long // 15 minutes cache (permissions rarely change)
    )

    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('Error in ultra-optimized user permissions API:', error)
    return NextResponse.json({ permissions: [] })
  }
}
