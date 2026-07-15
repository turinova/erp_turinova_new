/**
 * Push category description fields to ShopRenter (lean, no pull-verify).
 */

import { getCategoryWithDescriptions } from '@/lib/categories-server'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  getLanguageId,
  getCategoryDescriptionId
} from '@/lib/shoprenter-api'
import { getShopRenterRateLimiter, ShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { HU_LANG_ID } from '@/lib/category-geo-validator'

export interface ShopRenterConnectionContext {
  connectionId: string
  authHeader: string
  apiBaseUrl: string
  languageId: string
  rateLimiter: ShopRenterRateLimiter
}

const contextCache = new Map<string, ShopRenterConnectionContext>()

export async function getShopRenterConnectionContext(
  connectionId: string,
  tenantId?: string
): Promise<ShopRenterConnectionContext | null> {
  const cacheKey = `${connectionId}:${tenantId || 'default'}`
  if (contextCache.has(cacheKey)) return contextCache.get(cacheKey)!

  const connection = await getConnectionById(connectionId)
  if (!connection || connection.connection_type !== 'shoprenter') return null

  const shopName = extractShopNameFromUrl(connection.api_url)
  if (!shopName) return null

  const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
    shopName,
    connection.username,
    connection.password,
    connection.api_url
  )

  const languageId = await getLanguageId(apiBaseUrl, authHeader, 'hu')
  if (!languageId) return null

  const ctx: ShopRenterConnectionContext = {
    connectionId,
    authHeader,
    apiBaseUrl,
    languageId,
    rateLimiter: getShopRenterRateLimiter(tenantId)
  }

  contextCache.set(cacheKey, ctx)
  return ctx
}

export function clearShopRenterConnectionContextCache() {
  contextCache.clear()
}

export async function pushCategoryToShopRenter(
  supabase: any,
  categoryId: string,
  ctx: ShopRenterConnectionContext
): Promise<{ success: boolean; error?: string }> {
  const category = await getCategoryWithDescriptions(categoryId)
  if (!category) return { success: false, error: 'Kategória nem található' }

  const descriptions = category.shoprenter_category_descriptions || []
  const huDescription =
    descriptions.find((d: any) => d.language_id === ctx.languageId || d.language_id === HU_LANG_ID) ||
    descriptions[0]

  if (!huDescription) {
    return { success: false, error: 'Nincs leírás a kategóriához' }
  }

  try {
    const descriptionId = await getCategoryDescriptionId(
      ctx.apiBaseUrl,
      ctx.authHeader,
      category.shoprenter_id,
      ctx.languageId,
      huDescription.shoprenter_id
    )

    const payload: Record<string, unknown> = {
      name: huDescription.name || category.name || '',
      metaKeywords: huDescription.meta_keywords || null,
      metaDescription: huDescription.meta_description || null,
      description: huDescription.description || null,
      customTitle: huDescription.custom_title || null,
      robotsMetaTag: huDescription.robots_meta_tag || '0',
      footerSeoText: huDescription.footer_seo_text || null,
      category: { id: category.shoprenter_id },
      language: { id: ctx.languageId }
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === null) delete payload[key]
    })

    const updateUrl = descriptionId
      ? `${ctx.apiBaseUrl}/categoryDescriptions/${descriptionId}`
      : `${ctx.apiBaseUrl}/categoryDescriptions`
    const method = descriptionId ? 'PUT' : 'POST'

    const pushResponse = await ctx.rateLimiter.execute(() =>
      fetch(updateUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: ctx.authHeader
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      })
    )

    const responseText = await pushResponse.text().catch(() => '')

    if (!pushResponse.ok) {
      const errMsg = `ShopRenter ${pushResponse.status}: ${responseText.substring(0, 200)}`
      await supabase
        .from('shoprenter_categories')
        .update({
          sync_status: 'error',
          sync_error: errMsg,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', categoryId)
      return { success: false, error: errMsg }
    }

    if (!responseText?.trim()) {
      const errMsg = 'ShopRenter üres választ adott'
      await supabase
        .from('shoprenter_categories')
        .update({
          sync_status: 'error',
          sync_error: errMsg,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', categoryId)
      return { success: false, error: errMsg }
    }

    let pushResult: any = null
    try {
      pushResult = JSON.parse(responseText)
    } catch {
      /* ok if not json */
    }

    let finalDescriptionId = descriptionId
    if (!finalDescriptionId && pushResult?.id) finalDescriptionId = pushResult.id
    else if (!finalDescriptionId && pushResult?.href) {
      const parts = pushResult.href.split('/')
      finalDescriptionId = parts[parts.length - 1]
    }

    if (finalDescriptionId && !huDescription.shoprenter_id) {
      await supabase
        .from('shoprenter_category_descriptions')
        .update({ shoprenter_id: finalDescriptionId })
        .eq('id', huDescription.id)
    }

    await supabase
      .from('shoprenter_categories')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', categoryId)

    return { success: true }
  } catch (e: any) {
    const errMsg = e?.message || 'Ismeretlen hiba'
    await supabase
      .from('shoprenter_categories')
      .update({
        sync_status: 'error',
        sync_error: errMsg,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', categoryId)
    return { success: false, error: errMsg }
  }
}
