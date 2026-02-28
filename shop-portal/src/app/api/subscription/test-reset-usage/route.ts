import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/subscription/test-reset-usage
 * Reset credit usage for current month (development only)
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all credit usage logs for current month
    const { error: deleteError } = await supabase
      .from('ai_usage_logs')
      .delete()
      .eq('user_id', user.id)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lt('created_at', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString())

    if (deleteError) {
      console.error('Error resetting credit usage:', deleteError)
      return NextResponse.json({ error: 'Failed to reset credit usage' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Credit usage reset for current month'
    })
  } catch (error) {
    console.error('Error in POST /api/subscription/test-reset-usage:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset credit usage'
    }, { status: 500 })
  }
}
