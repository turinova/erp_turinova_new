import { extractShopNameFromUrl, getShopRenterAuthHeader } from '@/lib/shoprenter-api'

export interface LiveOfferData {
  priceGross: number
  availability: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock'
  url: string
  source: 'live'
}

type LiveOfferMap = Record<string, LiveOfferData>

interface ConnectionInput {
  api_url: string
  username: string
  password: string
}

const CACHE_TTL_MS = 120 * 1000
const offerCache = new Map<string, { expiresAt: number; value: LiveOfferMap | null }>()

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const normalized = value.replace(',', '.').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseStockValue(value: unknown): number {
  const parsed = parseNumber(value)
  if (parsed === null || !Number.isFinite(parsed)) return 0
  return parsed
}

function resolveGrossPriceFromProductPrices(item: any): number | null {
  const prices = Array.isArray(item?.productPrices) ? item.productPrices : []
  if (prices.length === 0) return null

  const defaultPrice =
    prices.find((p: any) => p?.customerGroup?.default === true) ||
    prices.find((p: any) => p?.customerGroup?.default === '1') ||
    prices[0]

  return (
    parseNumber(defaultPrice?.grossSpecial) ??
    parseNumber(defaultPrice?.gross) ??
    parseNumber(defaultPrice?.grossOriginal) ??
    null
  )
}

function normalizeAvailability(raw: unknown): 'https://schema.org/InStock' | 'https://schema.org/OutOfStock' {
  const text = String(raw ?? '').toLowerCase()
  const inStockHints = ['instock', 'in_stock', 'available', 'elérhető', 'raktáron', '1', 'true']
  return inStockHints.some((hint) => text.includes(hint))
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock'
}

function isValidOffer(offer: Partial<LiveOfferData> | null | undefined): offer is LiveOfferData {
  if (!offer) return false
  if (typeof offer.priceGross !== 'number' || !Number.isFinite(offer.priceGross) || offer.priceGross <= 0) return false
  if (!offer.url || typeof offer.url !== 'string') return false
  if (!offer.availability || !offer.availability.startsWith('https://schema.org/')) return false
  return true
}

function resolveUrl(shopUrl: string, productUrl: unknown, fallbackSku: string): string {
  const value = typeof productUrl === 'string' ? productUrl.trim() : ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (!shopUrl) return value || ''
  if (value) return `${shopUrl}/${value.replace(/^\//, '')}`
  return `${shopUrl}/product/${encodeURIComponent(fallbackSku)}`
}

function extractShopUrl(apiUrl: string): string {
  const match = apiUrl.match(/https?:\/\/([^.]+)\.api(?:2)?\.myshoprenter\.hu/)
  return match && match[1] ? `https://${match[1]}.myshoprenter.hu` : ''
}

function buildOfferFromItem(item: any, shopUrl: string): { sku: string; offer: LiveOfferData } | null {
  const sku = String(item?.sku ?? item?.model ?? '').trim()
  if (!sku) return null

  const grossPrice =
    resolveGrossPriceFromProductPrices(item) ??
    parseNumber(item?.priceGross) ??
    parseNumber(item?.gross_price) ??
    parseNumber(item?.price_gross) ??
    parseNumber(item?.brutto_price) ??
    parseNumber(item?.price_brutto) ??
    parseNumber(item?.specialPrice) ??
    parseNumber(item?.special_price)

  const status = String(item?.status ?? '').trim()
  const subtractStock = String(item?.subtractStock ?? item?.subtract_stock ?? '').trim()
  const stockTotal =
    parseStockValue(item?.stock1) +
    parseStockValue(item?.stock2) +
    parseStockValue(item?.stock3) +
    parseStockValue(item?.stock4)
  const quantity = parseStockValue(item?.quantity)

  let availability: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock' = 'https://schema.org/OutOfStock'
  if (status === '1') {
    if (subtractStock === '0') {
      availability = 'https://schema.org/InStock'
    } else {
      const stockSignal = Math.max(stockTotal, quantity)
      availability = stockSignal > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  }

  const url = resolveUrl(shopUrl, item?.url ?? item?.product_url ?? item?.productUrl ?? item?.link, sku)
  const offer: Partial<LiveOfferData> = {
    priceGross: grossPrice ?? NaN,
    availability,
    url,
    source: 'live'
  }

  if (!isValidOffer(offer)) return null
  return { sku, offer }
}

async function fetchJson(url: string, authHeader: string): Promise<any | null> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader
    },
    signal: AbortSignal.timeout(8000)
  })

  if (!response.ok) return null
  return response.json().catch(() => null)
}

function getItems(payload: any): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.response?.items)) return payload.response.items
  if (Array.isArray(payload.products)) return payload.products
  if (Array.isArray(payload.response?.products)) return payload.response.products
  if (payload.product) return [payload.product]
  if (payload.response?.product) return [payload.response.product]
  if (payload.sku && (payload.productPrices || payload.price || payload.status !== undefined)) return [payload]
  if (
    payload.response &&
    payload.response.sku &&
    (payload.response.productPrices || payload.response.price || payload.response.status !== undefined)
  ) {
    return [payload.response]
  }
  return []
}

export async function fetchLiveOffersBySku(params: {
  tenantKey: string
  rootSku: string
  relatedSkus: string[]
  connection: ConnectionInput | null
}): Promise<LiveOfferMap | null> {
  const { tenantKey, rootSku, relatedSkus, connection } = params
  if (!connection?.api_url || !connection.username || !connection.password) {
    console.warn('[SHOPRENTER LIVE OFFERS] Missing connection credentials', {
      hasApiUrl: Boolean(connection?.api_url),
      hasUsername: Boolean(connection?.username),
      hasPassword: Boolean(connection?.password),
      rootSku
    })
    return null
  }

  const cacheKey = `${tenantKey}:${rootSku}`
  const cached = offerCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const parsedShopName = extractShopNameFromUrl(connection.api_url)
    const fallbackShopName = connection.api_url
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .split('.')[0]
      .trim()
    const shopName = parsedShopName || fallbackShopName
    if (!shopName) {
      console.warn('[SHOPRENTER LIVE OFFERS] Could not determine shop name from api_url:', connection.api_url)
      return null
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    const shopUrl = extractShopUrl(connection.api_url)
    const skuSet = new Set([rootSku, ...relatedSkus].filter(Boolean))
    const results: LiveOfferMap = {}
    const baseUrls = Array.from(
      new Set([
        apiBaseUrl.replace(/\/$/, ''),
        apiBaseUrl.replace(/\/api\/?$/, ''),
        apiBaseUrl.endsWith('/api') ? apiBaseUrl : `${apiBaseUrl.replace(/\/$/, '')}/api`
      ])
    )

    const endpointCandidates: string[] = []
    for (const baseUrl of baseUrls) {
      endpointCandidates.push(
        `${baseUrl}/productExtend?full=1&limit=100&filter[sku]=${encodeURIComponent(rootSku)}`,
        `${baseUrl}/productExtend?full=1&sku=${encodeURIComponent(rootSku)}`,
        `${baseUrl}/productExtend?full=1&search=${encodeURIComponent(rootSku)}`,
        `${baseUrl}/productExtend?full=1&limit=250`
      )
    }

    for (const endpoint of endpointCandidates) {
      const payload = await fetchJson(endpoint, authHeader)
      if (!payload) continue
      const items = getItems(payload)
      for (const item of items) {
        const built = buildOfferFromItem(item, shopUrl)
        if (built && skuSet.has(built.sku)) {
          results[built.sku] = built.offer
        }

        // Some ShopRenter payloads contain nested variants.
        const nested = [
          ...(Array.isArray(item?.variants) ? item.variants : []),
          ...(Array.isArray(item?.children) ? item.children : [])
        ]
        for (const variant of nested) {
          const nestedBuilt = buildOfferFromItem(variant, shopUrl)
          if (nestedBuilt && skuSet.has(nestedBuilt.sku)) {
            results[nestedBuilt.sku] = nestedBuilt.offer
          }
        }
      }

      const rootItem = items.find((item: any) => String(item?.sku ?? '') === rootSku) || items[0]
      const parentId = rootItem?.id
      if (parentId) {
        for (const baseUrl of baseUrls) {
          const variantPayload = await fetchJson(
            `${baseUrl}/productExtend?full=1&filter[parent_id]=${encodeURIComponent(parentId)}&limit=250`,
            authHeader
          )
          const variants = getItems(variantPayload)
          for (const variant of variants) {
            const built = buildOfferFromItem(variant, shopUrl)
            if (built && skuSet.has(built.sku)) {
              results[built.sku] = built.offer
            }
          }
        }
      }

      if (Object.keys(results).length > 0) break
    }

    // Last resort: broad list query and match locally by SKU.
    if (Object.keys(results).length === 0) {
      for (const baseUrl of baseUrls) {
        const broadPayload = await fetchJson(`${baseUrl}/productExtend?full=1&limit=500`, authHeader)
        const broadItems = getItems(broadPayload)
        for (const item of broadItems) {
          const built = buildOfferFromItem(item, shopUrl)
          if (built && skuSet.has(built.sku)) {
            results[built.sku] = built.offer
          }
        }
      }
    }

    // Final strict completion pass:
    // query missing SKUs one-by-one so ProductGroup variants can all get live offers.
    const missingSkus = Array.from(skuSet).filter((sku) => !results[sku])
    if (missingSkus.length > 0) {
      for (const sku of missingSkus) {
        for (const baseUrl of baseUrls) {
          const byFilter = await fetchJson(
            `${baseUrl}/productExtend?full=1&limit=5&filter[sku]=${encodeURIComponent(sku)}`,
            authHeader
          )
          const byFilterItems = getItems(byFilter)
          let resolved = false
          for (const item of byFilterItems) {
            const built = buildOfferFromItem(item, shopUrl)
            if (built && built.sku === sku) {
              results[sku] = built.offer
              resolved = true
              break
            }
          }
          if (resolved) break

          const bySearch = await fetchJson(
            `${baseUrl}/productExtend?full=1&limit=10&search=${encodeURIComponent(sku)}`,
            authHeader
          )
          const bySearchItems = getItems(bySearch)
          for (const item of bySearchItems) {
            const built = buildOfferFromItem(item, shopUrl)
            if (built && built.sku === sku) {
              results[sku] = built.offer
              resolved = true
              break
            }
          }
          if (resolved) break
        }
      }
    }

    const finalResult = Object.keys(results).length > 0 ? results : null
    if (!finalResult) {
      console.warn('[SHOPRENTER LIVE OFFERS] No live offers found', {
        rootSku,
        relatedSkuCount: relatedSkus.length,
        apiUrl: connection.api_url,
        baseUrls
      })
    }
    offerCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: finalResult })
    return finalResult
  } catch (error) {
    console.error('[SHOPRENTER LIVE OFFERS] Fetch failed', {
      rootSku,
      apiUrl: connection?.api_url,
      error: error instanceof Error ? error.message : String(error)
    })
    offerCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: null })
    return null
  }
}
