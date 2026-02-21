import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { getShopRenterAuthHeader, extractShopNameFromUrl } from '@/lib/shoprenter-api'
import {
  getScriptTags,
  findStructuredDataScriptTag,
  createScriptTag,
  updateScriptTag,
  deleteScriptTag,
  ensureStructuredDataScriptTag
} from '@/lib/shoprenter-script-tag-service'

/**
 * GET /api/connections/[id]/script-tag
 * Get script tags for a connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params

    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Connection not found or invalid type' }, { status: 404 })
    }

    // Get auth header
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL' }, { status: 400 })
    }

    const authResult = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get script tags
    const scriptTags = await getScriptTags({
      id: connection.id,
      api_url: authResult.apiBaseUrl,
      auth_header: authResult.authHeader,
      shop_name: shopName
    })

    return NextResponse.json({
      success: true,
      scriptTags
    })
  } catch (error) {
    console.error('[Script Tag API] Error fetching script tags:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/connections/[id]/script-tag
 * Create or update structured data script tag
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const body = await request.json().catch(() => ({}))
    let { scriptUrl } = body

    // If scriptUrl not provided, construct it automatically
    if (!scriptUrl) {
      // Get the base URL from request
      const protocol = request.headers.get('x-forwarded-proto') || 'https'
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
      
      if (!host) {
        return NextResponse.json({ error: 'Cannot determine host for script URL' }, { status: 400 })
      }

      const baseUrl = `${protocol}://${host}`
      const apiUrl = encodeURIComponent(baseUrl)
      scriptUrl = `${baseUrl}/scripts/shoprenter-structured-data.js?apiUrl=${apiUrl}`
    }

    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Connection not found or invalid type' }, { status: 404 })
    }

    // Get auth header
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL' }, { status: 400 })
    }

    const authResult = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Ensure script tag exists (create or update)
    const scriptTag = await ensureStructuredDataScriptTag(
      {
        id: connection.id,
        api_url: authResult.apiBaseUrl,
        auth_header: authResult.authHeader,
        shop_name: shopName
      },
      scriptUrl
    )

    return NextResponse.json({
      success: true,
      scriptTag
    })
  } catch (error) {
    console.error('[Script Tag API] Error creating/updating script tag:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/connections/[id]/script-tag
 * Delete structured data script tag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const { searchParams } = new URL(request.url)
    const scriptTagId = searchParams.get('scriptTagId')

    if (!scriptTagId) {
      return NextResponse.json({ error: 'scriptTagId is required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Connection not found or invalid type' }, { status: 404 })
    }

    // Get auth header
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL' }, { status: 400 })
    }

    const authResult = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Delete script tag
    await deleteScriptTag(
      {
        id: connection.id,
        api_url: authResult.apiBaseUrl,
        auth_header: authResult.authHeader,
        shop_name: shopName
      },
      scriptTagId
    )

    return NextResponse.json({
      success: true,
      message: 'Script tag deleted successfully'
    })
  } catch (error) {
    console.error('[Script Tag API] Error deleting script tag:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
