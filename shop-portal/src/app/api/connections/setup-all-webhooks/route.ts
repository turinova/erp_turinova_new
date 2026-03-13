import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getAdminSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import { setupShopRenterWebhook } from '@/lib/webhook-setup'

/**
 * POST /api/connections/setup-all-webhooks
 * 
 * Sets up webhooks for all existing active ShopRenter connections.
 * This is useful for fixing existing connections that were created before
 * automatic webhook setup was implemented.
 * 
 * Also syncs connection mappings to admin database.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const adminSupabase = await getAdminSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    let tenantContext = await getTenantFromSession()
    
    // Fallback: try to get tenant from user session
    if (!tenantContext) {
      // Try to get tenant from user's tenant database
      const { data: tenantData } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()
      
      // If we can't get tenant context, we need tenant_id from request
      const body = await request.json().catch(() => ({}))
      const tenantIdFromRequest = body.tenant_id || request.nextUrl.searchParams.get('tenant_id')
      
      if (!tenantIdFromRequest) {
        return NextResponse.json(
          { 
            error: 'Could not determine tenant context',
            details: 'Please provide tenant_id in request body or ensure you are logged in with tenant context'
          },
          { status: 400 }
        )
      }
      
      // Verify tenant exists
      const { data: tenant } = await adminSupabase
        .from('tenants')
        .select('id, name, slug')
        .eq('id', tenantIdFromRequest)
        .single()
      
      if (!tenant) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        )
      }
      
      tenantContext = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        supabase_url: '', // Not needed for this operation
        supabase_anon_key: '', // Not needed for this operation
        user_id_in_tenant_db: user.id,
        user_role: 'authenticated'
      }
    }

    const tenantId = tenantContext.id

    // Get all active ShopRenter connections
    const { data: connections, error: connectionsError } = await supabase
      .from('webshop_connections')
      .select('id, name, api_url, username, password, connection_type, is_active')
      .eq('connection_type', 'shoprenter')
      .eq('is_active', true)
      .is('deleted_at', null)

    if (connectionsError) {
      console.error('[SETUP ALL WEBHOOKS] Error fetching connections:', connectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch connections', details: connectionsError.message },
        { status: 500 }
      )
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active ShopRenter connections found',
        webhooks_created: 0,
        mappings_synced: 0
      })
    }

    console.log(`[SETUP ALL WEBHOOKS] Setting up webhooks for ${connections.length} connections`)

    const results = {
      webhooks_created: 0,
      webhooks_failed: 0,
      mappings_synced: 0,
      mappings_failed: 0,
      details: [] as Array<{
        connection_id: string
        connection_name: string
        webhook_success: boolean
        webhook_error?: string
        webhook_id?: string
        mapping_success: boolean
        mapping_error?: string
      }>
    }

    // Process each connection
    for (const connection of connections) {
      const connectionResult: typeof results.details[0] = {
        connection_id: connection.id,
        connection_name: connection.name,
        webhook_success: false,
        mapping_success: false
      }

      // 1. Setup webhook in ShopRenter
      try {
        const webhookResult = await setupShopRenterWebhook(connection)
        
        if (webhookResult.success) {
          connectionResult.webhook_success = true
          connectionResult.webhook_id = webhookResult.webhook_id
          results.webhooks_created++
        } else {
          connectionResult.webhook_error = webhookResult.error
          results.webhooks_failed++
        }
      } catch (error) {
        connectionResult.webhook_error = error instanceof Error ? error.message : String(error)
        results.webhooks_failed++
      }

      // 2. Sync connection mapping to admin database
      try {
        // Extract store name from api_url
        const apiUrl = connection.api_url
        let storeName: string | null = null
        
        const match = apiUrl.match(/https?:\/\/([^.]+)\.api(2)?\.myshoprenter\.hu/)
        if (match && match[1]) {
          storeName = match[1]
        }

        // Upsert mapping
        const { error: mappingError } = await adminSupabase
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

        if (mappingError) {
          connectionResult.mapping_error = mappingError.message
          results.mappings_failed++
        } else {
          connectionResult.mapping_success = true
          results.mappings_synced++
        }
      } catch (error) {
        connectionResult.mapping_error = error instanceof Error ? error.message : String(error)
        results.mappings_failed++
      }

      results.details.push(connectionResult)
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${connections.length} connections`,
      tenant_id: tenantId,
      tenant_name: tenantContext.name,
      summary: {
        total_connections: connections.length,
        webhooks_created: results.webhooks_created,
        webhooks_failed: results.webhooks_failed,
        mappings_synced: results.mappings_synced,
        mappings_failed: results.mappings_failed
      },
      details: results.details
    })

  } catch (error) {
    console.error('[SETUP ALL WEBHOOKS] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

