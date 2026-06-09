import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionByIdWithClient } from '@/lib/sync-chunk-continuation'
import { extractShopNameFromUrl, getShopRenterAuthHeader } from '@/lib/shoprenter-api'
import { ensureManufacturerExists } from '@/app/api/connections/[id]/sync-products/sync-product-db'

const PAGE_SIZE = 1000
const MANUFACTURER_BATCH_SIZE = 200

type ProductRow = {
  id: string
  sku: string | null
  manufacturer_id: string
}

/**
 * Batch-fetch manufacturer names from ShopRenter API.
 */
async function fetchManufacturerNames(
  apiUrl: string,
  authHeader: string,
  manufacturerIds: string[]
): Promise<Map<string, string | null>> {
  const manufacturerNamesMap = new Map<string, string | null>()

  for (let i = 0; i < manufacturerIds.length; i += MANUFACTURER_BATCH_SIZE) {
    const batch = manufacturerIds.slice(i, i + MANUFACTURER_BATCH_SIZE)
    const batchRequests = batch.map(manufacturerId => ({
      method: 'GET',
      uri: `${apiUrl}/manufacturers/${manufacturerId}?full=1`
    }))

    const batchPayload = {
      data: {
        requests: batchRequests
      }
    }

    try {
      const batchResponse = await fetch(`${apiUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify(batchPayload),
        signal: AbortSignal.timeout(60000)
      })

      if (!batchResponse.ok) {
        console.warn(`[BACKFILL] Failed to fetch Manufacturers batch: ${batchResponse.status}`)
        batch.forEach(manufacturerId => manufacturerNamesMap.set(manufacturerId, null))
        continue
      }

      const batchData = await batchResponse.json()
      const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []

      for (let j = 0; j < batchResponses.length && j < batch.length; j++) {
        const batchItem = batchResponses[j]
        const manufacturerId = batch[j]
        const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)

        if (statusCode >= 200 && statusCode < 300) {
          const manufacturer = batchItem.response?.body
          manufacturerNamesMap.set(manufacturerId, manufacturer?.name || null)
        } else {
          manufacturerNamesMap.set(manufacturerId, null)
          console.warn(`[BACKFILL] Failed to fetch Manufacturer ${manufacturerId}: status ${statusCode}`)
        }
      }
    } catch (error) {
      console.warn('[BACKFILL] Error fetching Manufacturers batch:', error)
      batch.forEach(manufacturerId => manufacturerNamesMap.set(manufacturerId, null))
    }
  }

  return manufacturerNamesMap
}

/**
 * POST /api/products/backfill-manufacturers
 * Link erp_manufacturer_id for products that have ShopRenter manufacturer_id but no ERP link.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const connectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : ''

    if (!connectionId) {
      return NextResponse.json({ error: 'connection_id kötelező' }, { status: 400 })
    }

    const connection = await getConnectionByIdWithClient(supabase, connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Kapcsolat nem található' }, { status: 404 })
    }

    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Érvénytelen API URL formátum' }, { status: 400 })
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    const products: ProductRow[] = []
    let offset = 0

    while (true) {
      const { data: page, error: productsError } = await supabase
        .from('shoprenter_products')
        .select('id, sku, manufacturer_id')
        .eq('connection_id', connectionId)
        .not('manufacturer_id', 'is', null)
        .is('erp_manufacturer_id', null)
        .is('deleted_at', null)
        .range(offset, offset + PAGE_SIZE - 1)

      if (productsError) {
        console.error('[BACKFILL] Error fetching products:', productsError)
        return NextResponse.json(
          { error: 'Hiba a termékek lekérdezésekor' },
          { status: 500 }
        )
      }

      if (!page || page.length === 0) {
        break
      }

      products.push(...(page as ProductRow[]))

      if (page.length < PAGE_SIZE) {
        break
      }

      offset += PAGE_SIZE
    }

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nincs szinkronizálandó termék',
        updated: 0,
        errors: 0,
        total: 0
      })
    }

    console.log(`[BACKFILL] Found ${products.length} products to backfill for connection ${connectionId}`)

    const productsByManufacturerId = new Map<string, ProductRow[]>()
    for (const product of products) {
      if (!product.manufacturer_id) {
        continue
      }
      const existing = productsByManufacturerId.get(product.manufacturer_id) || []
      existing.push(product)
      productsByManufacturerId.set(product.manufacturer_id, existing)
    }

    const manufacturerIds = Array.from(productsByManufacturerId.keys())
    const manufacturerNamesMap = await fetchManufacturerNames(apiBaseUrl, authHeader, manufacturerIds)

    let updated = 0
    let errors = 0
    const errorMessages: string[] = []

    for (const manufacturerId of manufacturerIds) {
      const manufacturerName = manufacturerNamesMap.get(manufacturerId)
      if (!manufacturerName?.trim()) {
        const affected = productsByManufacturerId.get(manufacturerId) || []
        errors += affected.length
        if (errorMessages.length < 20) {
          errorMessages.push(`Gyártó ${manufacturerId}: név nem elérhető (${affected.length} termék)`)
        }
        continue
      }

      const erpManufacturerId = await ensureManufacturerExists(supabase, manufacturerName)
      if (!erpManufacturerId) {
        const affected = productsByManufacturerId.get(manufacturerId) || []
        errors += affected.length
        if (errorMessages.length < 20) {
          errorMessages.push(`Gyártó "${manufacturerName}": ERP rekord nem hozható létre`)
        }
        continue
      }

      const affectedProducts = productsByManufacturerId.get(manufacturerId) || []
      for (let i = 0; i < affectedProducts.length; i += 100) {
        const batch = affectedProducts.slice(i, i + 100)
        const productIds = batch.map(p => p.id)

        const { error: updateError } = await supabase
          .from('shoprenter_products')
          .update({ erp_manufacturer_id: erpManufacturerId })
          .in('id', productIds)

        if (updateError) {
          console.error(`[BACKFILL] Error updating products for manufacturer "${manufacturerName}":`, updateError)
          errors += batch.length
          if (errorMessages.length < 20) {
            errorMessages.push(`"${manufacturerName}": ${updateError.message}`)
          }
        } else {
          updated += batch.length
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill befejezve: ${updated} termék frissítve, ${errors} hiba`,
      updated,
      errors,
      total: products.length,
      manufacturersProcessed: manufacturerIds.length,
      errorMessages: errorMessages.slice(0, 20)
    })
  } catch (error) {
    console.error('[BACKFILL] Error in backfill manufacturers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
