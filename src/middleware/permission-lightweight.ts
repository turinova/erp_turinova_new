import type { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple in-memory cache for admin status (resets on server restart)
const adminCache = new Map<string, boolean>()

// Check if user is admin (cached)
async function isUserAdmin(userId: string): Promise<boolean> {
  // Check cache first
  if (adminCache.has(userId)) {
    return adminCache.get(userId)!
  }

  try {
    // Get the first user (admin) from the database
    const { data: firstUser, error } = await supabase
      .from('auth.users')
      .select('id, created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching first user:', error)
      
return false
    }

    const isAdmin = firstUser?.id === userId
    
    // Cache the result
    adminCache.set(userId, isAdmin)
    
    return isAdmin
  } catch (error) {
    console.error('Error checking admin status:', error)
    
return false
  }
}

// Check if a page requires permission check
export function shouldCheckPermission(pathname: string): { pagePath: string; permissionType: 'view' } | null {
  // Define protected routes that require permission checks
  const protectedRoutes = [
    '/opti',
    '/users',
    '/customers',
    '/company',
    '/vat'
  ]

  // Check if the current path matches any protected route
  for (const route of protectedRoutes) {
    if (pathname.startsWith(route)) {
      return { pagePath: route, permissionType: 'view' }
    }
  }

  return null
}

// Lightweight permission check
export async function checkPagePermission(
  req: NextRequest,
  pagePath: string,
  permissionType: 'view' | 'edit' | 'delete' = 'view'
): Promise<NextResponse | null> {
  try {
    // Get user ID from the request (you'll need to extract this from the session)
    // For now, we'll skip the check and let the frontend handle it
    // This prevents the middleware from making database calls on every request
    
    return null // Allow the request to proceed
  } catch (error) {
    console.error('Error in permission check:', error)
    
return null // Allow the request to proceed on error
  }
}
