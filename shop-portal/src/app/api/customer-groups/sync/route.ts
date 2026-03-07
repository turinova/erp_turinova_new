import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * POST /api/customer-groups/sync
 * Sync customer groups FROM ShopRenter (pull existing groups)
 * This creates/updates customer groups in ERP based on ShopRenter data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const body = await request.json()
    const { connection_id } = body

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!connection_id) {
      return NextResponse.json({ error: 'connection_id is required' }, { status: 400 })
    }

    // Get connection
    const connection = await getConnectionById(connection_id)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    // Get authentication
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Fetch all customer groups from ShopRenter
    const response = await fetch(`${apiBaseUrl}/customerGroups?full=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `Failed to fetch customer groups: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => null)
    const items = data?.items || data?.response?.items || []

    let synced = 0
    let created = 0
    let updated = 0

    // Process each customer group
    for (const shoprenterGroup of items) {
      const shoprenterId = shoprenterGroup.id || shoprenterGroup.href?.split('/').pop()
      const name = shoprenterGroup.name

      if (!shoprenterId || !name) {
        continue
      }

      // Generate code from name (uppercase, replace spaces with underscores)
      const code = name
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')

      // Check if customer group already exists in ERP
      const { data: existing } = await supabase
        .from('customer_groups')
        .select('id, shoprenter_customer_group_id')
        .or(`shoprenter_customer_group_id.eq.${shoprenterId},name.ilike.${name}`)
        .is('deleted_at', null)
        .limit(1)
        .single()

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('customer_groups')
          .update({
            shoprenter_customer_group_id: shoprenterId,
            name: name,
            code: code,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (!updateError) {
          updated++
          synced++
        }
      } else {
        // Create new
        const { error: createError } = await supabase
          .from('customer_groups')
          .insert({
            name: name,
            code: code,
            shoprenter_customer_group_id: shoprenterId,
            is_default: false, // Don't auto-set as default
            is_active: true
          })

        if (!createError) {
          created++
          synced++
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sikeresen szinkronizálva: ${synced} vevőcsoport (${created} új, ${updated} frissítve)`,
      synced,
      created,
      updated
    })
  } catch (error) {
    console.error('Error syncing customer groups:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
