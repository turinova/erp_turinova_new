import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple in-memory cache for admin status (resets on server restart)
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// GET /api/permissions/check-admin/[userId]/optimized - Fast admin check
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check cache first
    const cached = adminCache.get(userId)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json({ isAdmin: cached.isAdmin })
    }

    // Check if user is admin by checking if they have admin permissions on the /users page
    // Use a single JOIN query for better performance
    const { data: adminPermission, error } = await supabase
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
      return NextResponse.json({ isAdmin: false })
    }

    const isAdmin = adminPermission?.can_edit === true

    // Cache the result
    adminCache.set(userId, { isAdmin, timestamp: Date.now() })

    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error('Error in optimized check-admin API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
