import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getAllConnections } from '@/lib/connections-server'
import { setupShopRenterWebhook } from '@/lib/webhook-setup'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'

/**
 * GET /api/connections
 * Get all webshop connections
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connections = await getAllConnections()
    return NextResponse.json({ success: true, connections })
  } catch (error) {
    console.error('Error fetching connections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/connections
 * Create a new webshop connection
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      connection_type,
      api_url,
      username,
      password,
      agent_key,
      is_active,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled
    } = body

    if (!name || !connection_type) {
      return NextResponse.json(
        { error: 'A kapcsolat neve és típusa kötelező' },
        { status: 400 }
      )
    }

    const isShopRenter = connection_type === 'shoprenter'
    const isSzamlazz = connection_type === 'szamlazz'

    if (!isShopRenter && !isSzamlazz) {
      return NextResponse.json(
        { error: 'Ismeretlen kapcsolat típus' },
        { status: 400 }
      )
    }

    if (isShopRenter && (!api_url || !username || !password)) {
      return NextResponse.json(
        { error: 'ShopRenter kapcsolathoz az API URL, Client ID és Client Secret kötelező' },
        { status: 400 }
      )
    }

    if (isSzamlazz && !String(agent_key || password || '').trim()) {
      return NextResponse.json(
        { error: 'Szamlazz.hu kapcsolathoz az Agent Key kötelező' },
        { status: 400 }
      )
    }

    // Validate Search Console fields if enabled
    if (search_console_enabled && isShopRenter) {
      if (!search_console_property_url || !search_console_client_email || !search_console_private_key) {
        return NextResponse.json(
          { error: 'Search Console mezők kitöltése kötelező, ha az integráció engedélyezve van' },
          { status: 400 }
        )
      }
    }

    // Create connection
    const bufferAuto =
      isSzamlazz && Boolean((body as { buffer_auto_proforma_enabled?: boolean }).buffer_auto_proforma_enabled)
    const rawDueDays = (body as { buffer_auto_proforma_due_days?: unknown }).buffer_auto_proforma_due_days
    const nDue =
      rawDueDays === undefined || rawDueDays === null || rawDueDays === ''
        ? 8
        : typeof rawDueDays === 'number'
          ? rawDueDays
          : parseInt(String(rawDueDays), 10)
    const dueDaysParsed = Number.isFinite(nDue) ? Math.min(365, Math.max(0, Math.round(nDue))) : 8

    const { data, error } = await supabase
      .from('webshop_connections')
      .insert({
        name: name.trim(),
        connection_type,
        api_url: isShopRenter ? api_url.trim() : normalizeSzamlazzApiUrl(typeof api_url === 'string' ? api_url : ''),
        username: isShopRenter ? username.trim() : '',
        password: isShopRenter ? password : String(agent_key || password || '').trim(), // TODO: Encrypt in production
        is_active: is_active !== false,
        buffer_auto_proforma_enabled: isSzamlazz ? bufferAuto : false,
        buffer_auto_proforma_due_days: isSzamlazz ? dueDaysParsed : 8,
        search_console_property_url: search_console_enabled && isShopRenter ? search_console_property_url?.trim() || null : null,
        search_console_client_email: search_console_enabled && isShopRenter ? search_console_client_email?.trim() || null : null,
        search_console_private_key: search_console_enabled && isShopRenter ? search_console_private_key || null : null,
        search_console_enabled: Boolean(search_console_enabled && isShopRenter)
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating connection:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat létrehozásakor' },
        { status: 500 }
      )
    }

    // Automatically setup webhook for ShopRenter connections if active
    if (data.connection_type === 'shoprenter' && data.is_active) {
      const webhookResult = await setupShopRenterWebhook(data)
      if (!webhookResult.success) {
        console.warn('[CONNECTION CREATE] Webhook setup failed:', webhookResult.error)
        // Don't fail the connection creation if webhook setup fails
        // The user can manually setup the webhook later
      }
    }

    return NextResponse.json({ 
      success: true, 
      connection: data,
      webhook_setup: data.connection_type === 'shoprenter' && data.is_active ? 'attempted' : 'skipped'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
