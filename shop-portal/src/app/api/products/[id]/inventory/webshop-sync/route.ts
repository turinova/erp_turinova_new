import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { extractShopNameFromUrl, getShopRenterAuthHeader } from '@/lib/shoprenter-api'

type SyncStatus = 'in_sync' | 'drift' | 'unknown' | 'error'

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)

    
return Number.isFinite(parsed) ? parsed : 0
  }

  
return 0
}

function roundPublishableStock(value: number): number {
  return Math.max(0, Math.round(value))
}

async function getProductAndConnection(supabase: any, productId: string) {
  const { data: product, error } = await supabase
    .from('shoprenter_products')
    .select(`
      id,
      sku,
      shoprenter_id,
      connection_id,
      sync_error,
      sync_status,
      last_synced_to_shoprenter_at,
      webshop_connections(*)
    `)
    .eq('id', productId)
    .single()

  if (error || !product) {
    return { product: null, error: 'Termék nem található' }
  }

  return { product, error: null }
}

async function getAvailableStock(supabase: any, productId: string): Promise<number> {
  const { data, error } = await supabase
    .from('stock_summary')
    .select('quantity_available')
    .eq('product_id', productId)

  if (error || !data) return 0

  const totalAvailable = data.reduce((sum: number, row: any) => sum + parseNumeric(row.quantity_available), 0)

  
return Math.round(totalAvailable * 100) / 100
}

async function fetchCurrentShopStock(
  connection: any,
  shoprenterId: string
): Promise<{ webshopCurrentStock: number | null; fetchError: string | null }> {
  const shopName = extractShopNameFromUrl(connection.api_url || '')

  if (!shopName) {
    return { webshopCurrentStock: null, fetchError: 'Érvénytelen webshop API URL' }
  }

  try {
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    const response = await fetch(`${apiBaseUrl}/products/${shoprenterId}?full=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')

      
return {
        webshopCurrentStock: null,
        fetchError: `Nem sikerült lekérdezni a webshop készletet (${response.status}): ${errorText.slice(0, 120)}`
      }
    }

    const payload = await response.json().catch(() => ({}))

    const stock1Value =
      payload?.stock1 ??
      payload?.response?.stock1 ??
      payload?.product?.stock1 ??
      payload?.data?.stock1 ??
      null

    if (stock1Value === null || stock1Value === undefined || stock1Value === '') {
      return { webshopCurrentStock: 0, fetchError: null }
    }

    return { webshopCurrentStock: roundPublishableStock(parseNumeric(stock1Value)), fetchError: null }
  } catch (error: any) {
    return {
      webshopCurrentStock: null,
      fetchError: `Webshop készlet lekérés sikertelen: ${error?.message || 'Ismeretlen hiba'}`
    }
  }
}

function getBlockedReason(product: any): string | null {
  if (!product?.webshop_connections || product.webshop_connections.connection_type !== 'shoprenter') {
    return 'Ehhez a termékhez nincs érvényes ShopRenter kapcsolat.'
  }

  if (!product.shoprenter_id || String(product.shoprenter_id).startsWith('pending-')) {
    return 'A termék még nincs összekötve ShopRenter termékazonosítóval.'
  }

  
return null
}

async function buildPreviewResponse(supabase: any, productId: string) {
  const { product, error } = await getProductAndConnection(supabase, productId)

  if (error || !product) return { error, status: 404 as const }

  const erpAvailableStock = await getAvailableStock(supabase, productId)
  const stockToPush = roundPublishableStock(erpAvailableStock)
  const blockedReason = getBlockedReason(product)

  let webshopCurrentStock: number | null = null
  let fetchError: string | null = null

  if (!blockedReason) {
    const current = await fetchCurrentShopStock(product.webshop_connections, product.shoprenter_id)

    webshopCurrentStock = current.webshopCurrentStock
    fetchError = current.fetchError
  }

  let status: SyncStatus = 'unknown'
  let delta: number | null = null

  if (blockedReason) {
    status = 'error'
  } else if (webshopCurrentStock === null) {
    status = fetchError ? 'unknown' : 'error'
  } else {
    delta = stockToPush - webshopCurrentStock
    status = delta === 0 ? 'in_sync' : 'drift'
  }

  return {
    status: 200 as const,
    data: {
      erp_available_stock: erpAvailableStock,
      stock_to_push: stockToPush,
      webshop_current_stock: webshopCurrentStock,
      delta,
      status,
      can_push: !blockedReason,
      block_reason: blockedReason,
      fetch_warning: fetchError,
      last_pushed_at: product.last_synced_to_shoprenter_at || null,
      last_sync_error: product.sync_error || null
    }
  }
}

/**
 * GET /api/products/[id]/inventory/webshop-sync
 * Returns stock publish preview information for product-level push.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preview = await buildPreviewResponse(supabase, id)

    if (preview.status !== 200) {
      return NextResponse.json({ error: preview.error || 'Termék nem található' }, { status: preview.status })
    }

    return NextResponse.json(preview.data)
  } catch (error: any) {
    console.error('Error in inventory webshop-sync GET:', error)
    
return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id]/inventory/webshop-sync
 * Pushes product stock (stock1) to ShopRenter.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { product, error } = await getProductAndConnection(supabase, id)

    if (error || !product) {
      return NextResponse.json({ error: error || 'Termék nem található' }, { status: 404 })
    }

    const blockedReason = getBlockedReason(product)

    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 400 })
    }

    const erpAvailableStock = await getAvailableStock(supabase, id)
    const stockToPush = roundPublishableStock(erpAvailableStock)

    const shopName = extractShopNameFromUrl(product.webshop_connections.api_url || '')

    if (!shopName) {
      return NextResponse.json({ error: 'Érvénytelen webshop API URL' }, { status: 400 })
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      product.webshop_connections.username,
      product.webshop_connections.password,
      product.webshop_connections.api_url
    )

    const response = await fetch(`${apiBaseUrl}/products/${product.shoprenter_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        stock1: String(stockToPush)
      }),
      signal: AbortSignal.timeout(20000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      const userFacingError = `A webshop készlet frissítése sikertelen (${response.status}).`

      await supabase
        .from('shoprenter_products')
        .update({
          sync_status: 'error',
          sync_error: `${userFacingError} ${errorText.slice(0, 160)}`
        })
        .eq('id', id)

      return NextResponse.json({ error: userFacingError }, { status: 502 })
    }

    await supabase
      .from('shoprenter_products')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_to_shoprenter_at: new Date().toISOString()
      })
      .eq('id', id)

    const preview = await buildPreviewResponse(supabase, id)

    
return NextResponse.json({
      success: true,
      message: `Készlet sikeresen közzétéve (${stockToPush} db).`,
      stock_pushed: stockToPush,
      preview: preview.status === 200 ? preview.data : null
    })
  } catch (error: any) {
    console.error('Error in inventory webshop-sync POST:', error)
    
return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
