import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/connections/[id]/setup-webhook
 * 
 * Automatically sets up a webhook in ShopRenter for the given connection.
 * This endpoint creates a webhook subscription in ShopRenter that will send
 * order notifications to our ERP webhook endpoint.
 * 
 * Requirements:
 * - Connection must be active and of type 'shoprenter'
 * - API credentials must be valid
 * - ERP webhook URL must be accessible (HTTPS required for production)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('webshop_connections')
      .select('id, name, api_url, username, password, connection_type, is_active')
      .eq('id', connectionId)
      .eq('connection_type', 'shoprenter')
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found or inactive' },
        { status: 404 }
      )
    }

    // Get webhook URL from request body or environment
    const body = await request.json().catch(() => ({}))
    const webhookUrl = body.webhook_url || process.env.NEXT_PUBLIC_WEBHOOK_URL || process.env.WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { 
          error: 'Webhook URL required',
          details: 'Please provide webhook_url in request body or set NEXT_PUBLIC_WEBHOOK_URL environment variable'
        },
        { status: 400 }
      )
    }

    // Extract shop name from API URL
    // e.g., "http://vasalatmester.api.myshoprenter.hu" -> "vasalatmester"
    const apiUrlMatch = connection.api_url.match(/https?:\/\/([^.]+)\.api(2)?\.myshoprenter\.hu/)
    if (!apiUrlMatch || !apiUrlMatch[1]) {
      return NextResponse.json(
        { error: 'Invalid ShopRenter API URL format' },
        { status: 400 }
      )
    }

    const shopName = apiUrlMatch[1]
    const apiBaseUrl = connection.api_url.replace(/\/$/, '') // Remove trailing slash

    // Prepare webhook payload
    const webhookPayload = {
      event: 'order_confirm',
      status: '1', // Active
      label: `ERP Order Webhook - ${connection.name}`,
      webHookParameters: [
        {
          type: 'json',
          url: webhookUrl
        }
      ]
      // webHookDelay is optional - omit for immediate delivery
    }

    // Create webhook in ShopRenter using Basic Auth
    const authString = Buffer.from(`${connection.username}:${connection.password}`).toString('base64')
    
    const webhookApiUrl = `${apiBaseUrl}/webHooks`
    
    console.log(`[WEBHOOK SETUP] Creating webhook for connection ${connection.name} at ${webhookApiUrl}`)

    const shoprenterResponse = await fetch(webhookApiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!shoprenterResponse.ok) {
      const errorText = await shoprenterResponse.text()
      console.error(`[WEBHOOK SETUP] ShopRenter API error:`, {
        status: shoprenterResponse.status,
        statusText: shoprenterResponse.statusText,
        body: errorText
      })

      return NextResponse.json(
        { 
          error: 'Failed to create webhook in ShopRenter',
          details: errorText,
          status: shoprenterResponse.status
        },
        { status: 500 }
      )
    }

    const webhookData = await shoprenterResponse.json()

    console.log(`[WEBHOOK SETUP] Webhook created successfully:`, webhookData.id)

    // Optionally store webhook ID in connection metadata for future reference
    // You could add a webhook_id column to webshop_connections table

    return NextResponse.json({
      success: true,
      message: 'Webhook created successfully in ShopRenter',
      connection_id: connection.id,
      connection_name: connection.name,
      webhook_id: webhookData.id,
      webhook_url: webhookUrl,
      shoprenter_response: webhookData
    })

  } catch (error) {
    console.error('[WEBHOOK SETUP] Unexpected error:', error)
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
 * GET /api/connections/[id]/setup-webhook
 * 
 * Lists existing webhooks for the connection in ShopRenter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('webshop_connections')
      .select('id, name, api_url, username, password, connection_type, is_active')
      .eq('id', connectionId)
      .eq('connection_type', 'shoprenter')
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found or inactive' },
        { status: 404 }
      )
    }

    const apiBaseUrl = connection.api_url.replace(/\/$/, '')
    const authString = Buffer.from(`${connection.username}:${connection.password}`).toString('base64')

    // List webhooks from ShopRenter
    const shoprenterResponse = await fetch(`${apiBaseUrl}/webHooks`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`
      }
    })

    if (!shoprenterResponse.ok) {
      const errorText = await shoprenterResponse.text()
      return NextResponse.json(
        { 
          error: 'Failed to fetch webhooks from ShopRenter',
          details: errorText,
          status: shoprenterResponse.status
        },
        { status: 500 }
      )
    }

    const webhooksData = await shoprenterResponse.json()

    return NextResponse.json({
      success: true,
      connection_id: connection.id,
      connection_name: connection.name,
      webhooks: webhooksData
    })

  } catch (error) {
    console.error('[WEBHOOK LIST] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
