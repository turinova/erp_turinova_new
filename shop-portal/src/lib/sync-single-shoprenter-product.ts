/**
 * Single-product pull from ShopRenter (productExtend → syncProductToDatabase).
 * Shared by POST /connections/[id]/sync-products and POST /products/[id]/sync (verification pull)
 * so we never rely on HTTP self-calls to localhost / wrong origin.
 */

import { batchFetchAttributeDescriptions } from '@/lib/shoprenter-attribute-sync'
import { syncProductToDatabase } from '@/app/api/connections/[id]/sync-products/sync-product-db'

function inferAttributeTypeFromHref(
  href: string | undefined,
  attr: { type?: string }
): 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' {
  if (href) {
    if (href.includes('/listAttributes')) return 'LIST'
    if (href.includes('/textAttributes')) return 'TEXT'
    if (href.includes('/numberAttributes')) return 'INTEGER'
  }
  const t = attr?.type
  if (t === 'LIST' || t === 'INTEGER' || t === 'FLOAT' || t === 'TEXT') return t
  return 'TEXT'
}

function dedupeAttributeRequests(
  arr: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }>
): Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> {
  const seen = new Set<string>()
  const out: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
  for (const r of arr) {
    const key = `${r.attributeId}\0${r.attributeType}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

export type SyncSingleProductResult = { ok: true } | { ok: false; error: string; status?: number }

export async function syncSingleProductFromShopRenter(params: {
  supabase: any
  connection: any
  shoprenterProductId: string
  forceSync: boolean
  tenantId?: string | null
  apiUrl: string
  authHeader: string
}): Promise<SyncSingleProductResult> {
  const { supabase, connection, shoprenterProductId, forceSync, tenantId, authHeader } = params
  let apiUrl = params.apiUrl.replace(/\/$/, '')
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    apiUrl = `http://${apiUrl}`
  }

  const productUrl = `${apiUrl}/productExtend/${shoprenterProductId}?full=1`
  const response = await fetch(productUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader,
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    return {
      ok: false,
      error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
      status: response.status,
    }
  }

  const data = await response.json().catch(() => null)
  if (!data || !data.id) {
    return { ok: false, error: 'Nem található termék a válaszban', status: 500 }
  }

  try {
    let productClassName: string | null = null
    if (data.productClass) {
      let productClassId: string | null = null
      if (typeof data.productClass === 'object' && data.productClass.id) {
        productClassId = data.productClass.id
      } else if (data.productClass.href) {
        const hrefParts = data.productClass.href.split('/')
        productClassId = hrefParts[hrefParts.length - 1] || null
      }

      if (productClassId && apiUrl && authHeader) {
        try {
          const classUrl = `${apiUrl}/productClasses/${productClassId}?full=1`
          const classResponse = await fetch(classUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: authHeader,
            },
            signal: AbortSignal.timeout(10000),
          })

          if (classResponse.ok) {
            const classData = await classResponse.json()
            productClassName = classData?.name || null
            if (productClassName) {
              console.log(`[SYNC] Found Product Class name "${productClassName}" for single product sync`)
            }
          } else {
            console.warn(`[SYNC] Failed to fetch Product Class ${productClassId}: ${classResponse.status}`)
          }
        } catch (classError) {
          console.warn(`[SYNC] Failed to fetch Product Class name for single product:`, classError)
        }
      }
    }

    const attributeRequests: Array<{
      attributeId: string
      attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
    }> = []
    if (data.productAttributeExtend && Array.isArray(data.productAttributeExtend)) {
      data.productAttributeExtend.forEach((attr: any) => {
        let attributeId = attr.id || null
        if (!attributeId && attr.href) {
          const hrefParts = attr.href.split('/')
          attributeId = hrefParts[hrefParts.length - 1] || null
        }

        if (attributeId) {
          attributeRequests.push({
            attributeId,
            attributeType: inferAttributeTypeFromHref(attr.href, attr),
          })
        } else {
          console.warn(
            `[SYNC] Single product: Could not extract attribute ID for "${attr.name}" (href: ${attr.href}, id: ${attr.id})`
          )
        }
      })
    }

    let attributeDescriptionsMap = new Map<
      string,
      { display_name: string | null; prefix: string | null; postfix: string | null }
    >()
    if (attributeRequests.length > 0 && apiUrl && authHeader) {
      const deduped = dedupeAttributeRequests(attributeRequests)
      console.log(
        `[SYNC] Batch fetching ${deduped.length} unique attribute descriptions for single product sync (${attributeRequests.length} refs)`
      )
      attributeDescriptionsMap = await batchFetchAttributeDescriptions(apiUrl, authHeader, deduped, {
        tenantId: tenantId ?? undefined,
      })
      console.log(`[SYNC] Fetched ${attributeDescriptionsMap.size} attribute descriptions for single product`)
    }

    await syncProductToDatabase(
      supabase,
      connection,
      data,
      forceSync,
      apiUrl,
      authHeader,
      attributeDescriptionsMap,
      tenantId ?? undefined,
      undefined,
      productClassName,
      undefined
    )
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Ismeretlen hiba',
      status: 500,
    }
  }
}
