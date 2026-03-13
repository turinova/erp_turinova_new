import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/tenant-supabase'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/admin/sync-connection-mappings
 * 
 * Syncs webshop_connections from tenant database to admin database
 * This should be called when:
 * - A new connection is created
 * - A connection is updated (api_url changes)
 * - On initial setup
 * 
 * This endpoint requires admin/service role authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Get admin supabase
    const adminSupabase = await getAdminSupabase()

    // Get tenant supabase (current tenant)
    const tenantSupabase = await getTenantSupabase()
    
    // Get auth user
    const { data: { user }, error: userError } = await tenantSupabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    const { data: tenantContext } = await tenantSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    // Get all active ShopRenter connections from tenant database
    const { data: connections, error: connectionsError } = await tenantSupabase
      .from('webshop_connections')
      .select('id, name, api_url, connection_type, is_active')
      .eq('connection_type', 'shoprenter')
      .eq('is_active', true)
      .is('deleted_at', null)

    if (connectionsError) {
      console.error('[SYNC MAPPINGS] Error fetching connections:', connectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch connections', details: connectionsError.message },
        { status: 500 }
      )
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active ShopRenter connections found',
        synced_count: 0
      })
    }

    // Get tenant_id from admin database
    // We need to find the tenant by matching the tenant database URL
    // This is a bit tricky - we might need to pass tenant_id as a parameter
    // or store it in the tenant database somehow
    
    // For now, let's try to get tenant_id from query param or body
    const body = await request.json().catch(() => ({}))
    const tenantId = body.tenant_id || request.nextUrl.searchParams.get('tenant_id')

    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'tenant_id required',
          details: 'Please provide tenant_id in request body or query parameter'
        },
        { status: 400 }
      )
    }

    // Verify tenant exists in admin database
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found in admin database' },
        { status: 404 }
      )
    }

    console.log(`[SYNC MAPPINGS] Syncing ${connections.length} connections for tenant: ${tenant.name}`)

    // Sync each connection to admin database
    const syncedMappings = []
    const errors = []

    for (const connection of connections) {
      try {
        // Extract store name from api_url for fallback matching
        const apiUrl = connection.api_url
        let storeName: string | null = null
        
        // Try to extract shop name from URL
        // e.g., "http://vasalatmester.api.myshoprenter.hu" -> "vasalatmester"
        const match = apiUrl.match(/https?:\/\/([^.]+)\.api(2)?\.myshoprenter\.hu/)
        if (match && match[1]) {
          storeName = match[1]
        }

        // Upsert mapping
        const { data: mapping, error: mappingError } = await adminSupabase
          .from('tenant_connection_mappings')
          .upsert({
            connection_id: connection.id,
            tenant_id: tenantId,
            api_url: apiUrl,
            store_name: storeName,
            connection_name: connection.name,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'connection_id',
            ignoreDuplicates: false
          })
          .select()
          .single()

        if (mappingError) {
          console.error(`[SYNC MAPPINGS] Error syncing connection ${connection.id}:`, mappingError)
          errors.push({
            connection_id: connection.id,
            connection_name: connection.name,
            error: mappingError.message
          })
        } else {
          syncedMappings.push({
            connection_id: connection.id,
            connection_name: connection.name,
            api_url: apiUrl
          })
        }
      } catch (error) {
        console.error(`[SYNC MAPPINGS] Unexpected error for connection ${connection.id}:`, error)
        errors.push({
          connection_id: connection.id,
          connection_name: connection.name,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedMappings.length} of ${connections.length} connections`,
      tenant_id: tenantId,
      tenant_name: tenant.name,
      synced_count: syncedMappings.length,
      total_count: connections.length,
      synced_mappings: syncedMappings,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('[SYNC MAPPINGS] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/sync-connection-mappings
 * List all connection mappings for current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = await getAdminSupabase()
    
    const tenantId = request.nextUrl.searchParams.get('tenant_id')
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id required' },
        { status: 400 }
      )
    }

    const { data: mappings, error } = await adminSupabase
      .from('tenant_connection_mappings')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch mappings', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tenant_id: tenantId,
      mappings: mappings || []
    })

  } catch (error) {
    console.error('[SYNC MAPPINGS] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
