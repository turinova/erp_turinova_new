import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/tenants/[id]/users - Get users from tenant database
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const tenantId = resolvedParams.id

    // Get tenant from admin DB
    const adminSupabase = createAdminClient()
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('supabase_url, supabase_service_role_key')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    if (!tenant.supabase_url || !tenant.supabase_service_role_key) {
      return NextResponse.json(
        { success: false, error: 'Tenant database connection not configured' },
        { status: 400 }
      )
    }

    // Connect to tenant database using service role
    const tenantSupabase = createClient(
      tenant.supabase_url,
      tenant.supabase_service_role_key,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get users from tenant database
    const { data: users, error: usersError } = await tenantSupabase
      .from('users')
      .select('id, email, full_name, created_at, last_sign_in_at, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('[Admin] Error fetching tenant users:', usersError)
      return NextResponse.json(
        { success: false, error: usersError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      users: users || []
    })
  } catch (error: any) {
    console.error('[Admin] Error in GET /api/tenants/[id]/users:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
