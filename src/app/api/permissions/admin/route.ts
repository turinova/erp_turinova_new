import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAllUsersWithPermissions, getAllPages } from '@/lib/permissions-server'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all users and pages
    const [users, pages] = await Promise.all([
      getAllUsersWithPermissions(),
      getAllPages()
    ])
    
    return NextResponse.json({ users, pages })
    
  } catch (error) {
    console.error('Error fetching users and pages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
