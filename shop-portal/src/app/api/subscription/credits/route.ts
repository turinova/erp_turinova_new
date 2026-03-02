import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getCreditUsageStats } from '@/lib/credit-checker'

/**
 * GET /api/subscription/credits
 * Get current credit usage stats for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await getCreditUsageStats(user.id)

    return NextResponse.json({
      success: true,
      credits: stats
    })
  } catch (error) {
    console.error('Error fetching credit stats:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credit stats'
    }, { status: 500 })
  }
}
