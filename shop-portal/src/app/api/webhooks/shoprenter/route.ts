import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/tenant-supabase'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/webhooks/shoprenter
 * 
 * Central webhook endpoint for all ShopRenter webhooks.
 * Determines tenant database from webhook payload using admin database mapping.
 * 
 * Workflow:
 * 1. Receive webhook payload
 * 2. Extract storeName or other identifier from payload
 * 3. Query admin database: tenant_connection_mappings
 * 4. Get tenant_id and connection_id from mapping
 * 5. Connect to tenant database
 * 6. Store in order_buffer table
 */
export async function POST(request: NextRequest) {
  try {
    // Parse webhook payload
    const payload = await request.json()
    
    console.log('[WEBHOOK] Received ShopRenter webhook')
    
    // Extract store identifier from payload
    // ShopRenter webhook format: { "orders": { "order": [{ ... }] } }
    // Or: { "storeName": "...", ... }
    let storeName: string | null = null
    let apiUrl: string | null = null
    
    // Try to extract storeName from payload
    if (payload.storeName) {
      storeName = payload.storeName
    } else if (payload.orders?.order?.[0]?.storeName) {
      storeName = payload.orders.order[0].storeName
    }
    
    // Try to extract api_url from request headers or payload
    // ShopRenter might send the shop URL in headers
    const referer = request.headers.get('referer')
    if (referer) {
      // Extract shop name from referer URL
      // e.g., "https://vasalatmester.shoprenter.hu" -> "vasalatmester"
      const match = referer.match(/https?:\/\/([^.]+)\.(shoprenter\.hu|myshoprenter\.hu)/)
      if (match && match[1]) {
        const shopName = match[1]
        // Construct API URL
        apiUrl = `http://${shopName}.api.myshoprenter.hu`
      }
    }
    
    if (!storeName && !apiUrl) {
      console.error('[WEBHOOK] Could not extract store identifier from webhook payload')
      return NextResponse.json(
        { error: 'Could not identify store from webhook payload' },
        { status: 400 }
      )
    }
    
    console.log('[WEBHOOK] Extracted identifier:', { storeName, apiUrl })
    
    // Query admin database to find tenant and connection
    const adminSupabase = await getAdminSupabase()
    
    let mappingQuery = adminSupabase
      .from('tenant_connection_mappings')
      .select('connection_id, tenant_id, api_url, store_name')
      .limit(1)
    
    if (apiUrl) {
      mappingQuery = mappingQuery.eq('api_url', apiUrl)
    } else if (storeName) {
      mappingQuery = mappingQuery.eq('store_name', storeName)
    }
    
    const { data: mapping, error: mappingError } = await mappingQuery.single()
    
    if (mappingError || !mapping) {
      console.error('[WEBHOOK] Could not find tenant mapping:', mappingError)
      return NextResponse.json(
        { 
          error: 'Could not find tenant for this webhook',
          details: mappingError?.message || 'No mapping found for store identifier'
        },
        { status: 404 }
      )
    }
    
    const { connection_id, tenant_id } = mapping
    
    console.log('[WEBHOOK] Found mapping:', { connection_id, tenant_id })
    
    // Get tenant database connection info
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('supabase_url, supabase_service_role_key')
      .eq('id', tenant_id)
      .single()
    
    if (tenantError || !tenant) {
      console.error('[WEBHOOK] Could not find tenant:', tenantError)
      return NextResponse.json(
        { error: 'Could not find tenant database' },
        { status: 500 }
      )
    }
    
    // Connect to tenant database
    const tenantSupabase = createClient(
      tenant.supabase_url,
      tenant.supabase_service_role_key,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
    
    // Extract order information from payload
    // ShopRenter webhook format: { "orders": { "order": [{ ... }] } }
    let orderData = null
    if (payload.orders?.order) {
      // Handle array of orders
      orderData = Array.isArray(payload.orders.order) 
        ? payload.orders.order[0] 
        : payload.orders.order
    } else if (payload.order) {
      orderData = payload.order
    } else {
      orderData = payload
    }
    
    if (!orderData || !orderData.innerId) {
      console.error('[WEBHOOK] Invalid order data in payload')
      return NextResponse.json(
        { error: 'Invalid order data in webhook payload' },
        { status: 400 }
      )
    }
    
    const platform_order_id = orderData.innerId.toString()
    const platform_order_resource_id = orderData.innerResourceId || null
    
    // Check if order already exists in buffer (prevent duplicates)
    const { data: existingOrder, error: checkError } = await tenantSupabase
      .from('order_buffer')
      .select('id, status, received_at')
      .eq('connection_id', connection_id)
      .eq('platform_order_id', platform_order_id)
      .single()
    
    if (existingOrder && !checkError) {
      // Order already exists - update if newer
      const existingReceivedAt = new Date(existingOrder.received_at)
      const now = new Date()
      
      if (now > existingReceivedAt) {
        // Update existing order with new webhook data
        const { error: updateError } = await tenantSupabase
          .from('order_buffer')
          .update({
            webhook_data: payload,
            platform_order_resource_id,
            received_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existingOrder.id)
        
        if (updateError) {
          console.error('[WEBHOOK] Error updating existing order:', updateError)
          return NextResponse.json(
            { error: 'Failed to update existing order' },
            { status: 500 }
          )
        }
        
        console.log('[WEBHOOK] Updated existing order in buffer:', existingOrder.id)
        return NextResponse.json({ 
          success: true, 
          message: 'Order updated in buffer',
          order_id: existingOrder.id,
          action: 'updated'
        })
      } else {
        // Existing order is newer, ignore this webhook
        console.log('[WEBHOOK] Ignoring duplicate webhook (existing order is newer)')
        return NextResponse.json({ 
          success: true, 
          message: 'Duplicate webhook ignored',
          order_id: existingOrder.id,
          action: 'ignored'
        })
      }
    }
    
    // Insert new order into buffer
    const { data: newOrder, error: insertError } = await tenantSupabase
      .from('order_buffer')
      .insert({
        connection_id,
        platform_order_id,
        platform_order_resource_id,
        webhook_data: payload,
        status: 'pending',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    
    if (insertError) {
      console.error('[WEBHOOK] Error inserting order into buffer:', insertError)
      return NextResponse.json(
        { error: 'Failed to store order in buffer', details: insertError.message },
        { status: 500 }
      )
    }
    
    console.log('[WEBHOOK] Successfully stored order in buffer:', newOrder.id)
    
    return NextResponse.json({
      success: true,
      message: 'Order received and stored in buffer',
      order_id: newOrder.id,
      connection_id,
      tenant_id,
      action: 'created'
    })
    
  } catch (error) {
    console.error('[WEBHOOK] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
