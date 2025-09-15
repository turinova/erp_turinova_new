import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'

// Simple in-memory cache for user permissions (resets on server restart)
const permissionsCache = new Map<string, { permissions: any[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// GET /api/permissions/simple/user/[userId]/optimized - Get optimized user permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Check cache first
    const cached = permissionsCache.get(userId)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json({ permissions: cached.permissions })
    }

    // Single optimized query with JOIN to get permissions and page paths in one go
    const { data, error } = await supabaseOptimized
      .from('user_permissions')
      .select(`
        user_id,
        can_view,
        pages!inner(
          id,
          path
        )
      `)
      .eq('user_id', userId)
      .eq('pages.is_active', true)

    if (error) {
      console.error('Error fetching optimized permissions:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch permissions',
        permissions: [] 
      }, { status: 500 })
    }

    // Transform to simple format
    const transformedPermissions = data?.map(p => ({
      user_id: p.user_id,
      page_path: p.pages.path,
      can_access: p.can_view || false
    })) || []

    // Cache the result
    permissionsCache.set(userId, { permissions: transformedPermissions, timestamp: Date.now() })

    return NextResponse.json({ permissions: transformedPermissions })
  } catch (error) {
    console.error('Error in optimized permissions GET:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      permissions: [] 
    }, { status: 500 })
  }
}
