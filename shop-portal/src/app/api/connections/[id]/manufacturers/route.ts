import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * GET /api/connections/[id]/manufacturers
 * Fetch manufacturers from ShopRenter for a connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('webshop_connections')
      .select('*')
      .eq('id', id)
      .eq('connection_type', 'shoprenter')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Fetch manufacturers from ShopRenter
    const manufacturers: Array<{ id: string; name: string; innerId: string | null }> = []
    let page = 0
    const limit = 200
    let hasMore = true

    while (hasMore) {
      const response = await fetch(
        `${apiBaseUrl}/manufacturers?page=${page}&limit=${limit}&full=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        }
      )

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`[MANUFACTURERS] Failed to fetch page ${page}: ${response.status} - ${errorText}`)
        break
      }

      const data = await response.json()
      const items = data.items || []

      for (const item of items) {
        // Handle both full objects and href-only items
        if (item.name) {
          manufacturers.push({
            id: item.id,
            name: item.name,
            innerId: item.innerId || null
          })
        } else if (item.href) {
          // Fetch full manufacturer data
          try {
            const fullResponse = await fetch(item.href, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              signal: AbortSignal.timeout(5000)
            })

            if (fullResponse.ok) {
              const fullData = await fullResponse.json()
              manufacturers.push({
                id: fullData.id,
                name: fullData.name,
                innerId: fullData.innerId || null
              })
            }
          } catch (fetchError) {
            console.warn(`[MANUFACTURERS] Failed to fetch manufacturer from href:`, fetchError)
          }
        }
      }

      // Check if there are more pages
      hasMore = items.length === limit && data.next !== null
      page++
    }

    // Sort by name
    manufacturers.sort((a, b) => a.name.localeCompare(b.name, 'hu'))

    return NextResponse.json({
      success: true,
      manufacturers
    })
  } catch (error: any) {
    console.error('Error fetching manufacturers:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/connections/[id]/manufacturers
 * Create a new manufacturer in ShopRenter
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Manufacturer name is required' }, { status: 400 })
    }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('webshop_connections')
      .select('*')
      .eq('id', id)
      .eq('connection_type', 'shoprenter')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Create manufacturer in ShopRenter
    const response = await fetch(`${apiBaseUrl}/manufacturers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        name: name.trim(),
        sortOrder: '0',
        robotsMetaTag: '0'
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[MANUFACTURERS] Failed to create manufacturer: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: `Failed to create manufacturer: ${errorText.substring(0, 200)}` },
        { status: response.status }
      )
    }

    const manufacturer = await response.json()

    return NextResponse.json({
      success: true,
      manufacturer: {
        id: manufacturer.id,
        name: manufacturer.name,
        innerId: manufacturer.innerId || null
      }
    })
  } catch (error: any) {
    console.error('Error creating manufacturer:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
