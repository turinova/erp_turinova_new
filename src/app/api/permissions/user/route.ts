import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // For API routes, we don't need to set cookies back
          },
        },
      }
    )

    // Get current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user

    // Get user permissions using the RPC function directly
    const { data, error } = await supabase.rpc('get_user_permissions', {
      user_uuid: user.id
    })

    if (error) {
      console.error('Error fetching user permissions:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error fetching user permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
