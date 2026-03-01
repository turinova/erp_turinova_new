import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// POST /api/tenants/[id]/reset-usage - Reset monthly credit usage (mark logs as reset)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    // Get current admin user (for audit trail)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    let adminUserId: string | null = null

    if (!userError && user) {
      // Get admin user ID from admin_users table
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email)
        .single()
      
      if (adminUser) {
        adminUserId = adminUser.id
      }
    }

    // Get current month date range
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

    // Mark all current month logs as reset (for audit trail)
    const { data: updatedLogs, error: updateError } = await supabase
      .from('tenant_credit_usage_logs')
      .update({
        is_reset: true,
        reset_at: new Date().toISOString(),
        reset_by_admin_id: adminUserId
      })
      .eq('tenant_id', id)
      .gte('created_at', firstDayOfMonth)
      .lte('created_at', lastDayOfMonth)
      .is('is_reset', false) // Only reset logs that haven't been reset yet
      .select()

    if (updateError) {
      console.error('Error resetting usage logs:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Update last_usage_reset_at timestamp on subscription
    const { error: subscriptionUpdateError } = await supabase
      .from('tenant_subscriptions')
      .update({ last_usage_reset_at: new Date().toISOString() })
      .eq('tenant_id', id)

    if (subscriptionUpdateError) {
      console.error('Error updating reset timestamp:', subscriptionUpdateError)
      // Don't fail the request, just log the error
    }

    // Log admin action
    if (adminUserId) {
      await supabase
        .from('admin_actions_log')
        .insert({
          admin_user_id: adminUserId,
          tenant_id: id,
          action_type: 'reset_credit_usage',
          details: {
            logs_reset: updatedLogs?.length || 0,
            month: now.toISOString().substring(0, 7) // YYYY-MM
          }
        })
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${updatedLogs?.length || 0} usage logs for current month`,
      logsReset: updatedLogs?.length || 0
    })

  } catch (error) {
    console.error('Error in POST /api/tenants/[id]/reset-usage:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset usage'
    }, { status: 500 })
  }
}
