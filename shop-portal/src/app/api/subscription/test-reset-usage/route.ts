import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getAdminSupabase, getTenantFromSession } from '@/lib/tenant-supabase'

/**
 * POST /api/subscription/test-reset-usage
 * Reset credit usage for current month (development only)
 * NOTE: This route uses tenant-level credit logs in Admin DB
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    const tenant = await getTenantFromSession()
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
    }

    // Use Admin DB for tenant credit logs
    const adminSupabase = await getAdminSupabase()

    // Mark all credit usage logs for current month as reset (don't delete for audit)
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

    const { error: updateError } = await adminSupabase
      .from('tenant_credit_usage_logs')
      .update({ is_reset: true })
      .eq('tenant_id', tenant.id)
      .gte('created_at', firstDayOfMonth)
      .lte('created_at', lastDayOfMonth)

    if (updateError) {
      console.error('Error resetting credit usage:', updateError)
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
