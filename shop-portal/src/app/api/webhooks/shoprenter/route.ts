import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/tenant-supabase'
import { createClient } from '@supabase/supabase-js'

/**
 * GET/HEAD /api/webhooks/shoprenter
 * ShopRenter may call these to validate the webhook URL when registering.
 * Return 200 so they don't treat the endpoint as invalid.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, message: 'Webhook endpoint ready' },
    { status: 200 }
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

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
    const contentType = request.headers.get('content-type') || ''
    let payload: unknown

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const raw = formData.get('data') ?? formData.get('payload') ?? formData.get('body')
      const text = raw == null ? '' : typeof raw === 'string' ? raw : await (raw as Blob).text()
      if (!text?.trim()) {
        return NextResponse.json(
          { error: 'Missing JSON field (data/payload/body) in multipart body' },
          { status: 400 }
        )
      }
      try {
        payload = JSON.parse(text)
      } catch (e) {
        console.error('[WEBHOOK] Multipart JSON parse failed. Body (truncated):', text.slice(0, 500))
        return NextResponse.json(
          { error: 'Invalid JSON in multipart field', details: e instanceof Error ? e.message : String(e) },
          { status: 400 }
        )
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      const raw = params.get('payload') ?? params.get('data') ?? params.get('body') ?? text
      try {
        payload = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch (e) {
        console.error('[WEBHOOK] Form body parse failed. Raw (truncated):', raw.slice(0, 500))
        return NextResponse.json(
          { error: 'Invalid JSON in form payload' },
          { status: 400 }
        )
      }
    } else {
      const text = await request.text()
      if (!text || !text.trim()) {
        console.error('[WEBHOOK] Empty body. Content-Type:', contentType)
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        )
      }
      try {
        payload = JSON.parse(text)
      } catch (e) {
        console.error('[WEBHOOK] JSON parse failed. Content-Type:', contentType, 'Body (truncated):', text.slice(0, 500))
        return NextResponse.json(
          { error: 'Invalid JSON', details: e instanceof Error ? e.message : String(e) },
          { status: 400 }
        )
      }
    }

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Payload must be a JSON object' }, { status: 400 })
    }
    const body = payload as Record<string, unknown>

    console.log('[WEBHOOK] Received ShopRenter webhook')
    
    // Extract store identifier from payload
    // ShopRenter webhook format: { "orders": { "order": [{ ... }] } }
    // Or: { "storeName": "...", ... }
    let storeName: string | null = null
    let apiUrl: string | null = null
    
    // Try to extract storeName from payload
    if (body.storeName) {
      storeName = String(body.storeName)
    } else if (body.orders && typeof body.orders === 'object' && body.orders !== null && !Array.isArray(body.orders)) {
      const orders = body.orders as Record<string, unknown>
      const orderArr = Array.isArray(orders.order) ? orders.order[0] : orders.order
      const first = orderArr && typeof orderArr === 'object' && orderArr !== null && 'storeName' in orderArr
        ? (orderArr as Record<string, unknown>).storeName
        : null
      if (first != null) storeName = String(first)
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
    let orderData: Record<string, unknown> | null = null
    const ordersObj = body.orders && typeof body.orders === 'object' && body.orders !== null ? (body.orders as Record<string, unknown>) : null
    const orderVal = ordersObj?.order
    if (orderVal !== undefined && orderVal !== null) {
      orderData = Array.isArray(orderVal) ? (orderVal[0] as Record<string, unknown>) : (orderVal as Record<string, unknown>)
    } else if (body.order !== undefined && body.order !== null && typeof body.order === 'object') {
      orderData = body.order as Record<string, unknown>
    } else {
      orderData = body
    }
    
    const innerId = orderData?.innerId
    if (!orderData || (innerId !== 0 && !innerId)) {
      console.error('[WEBHOOK] Invalid order data in payload')
      return NextResponse.json(
        { error: 'Invalid order data in webhook payload' },
        { status: 400 }
      )
    }
    
    const platform_order_id = String(orderData.innerId ?? '')
    const platform_order_resource_id = orderData.innerResourceId != null ? String(orderData.innerResourceId) : null
    
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
