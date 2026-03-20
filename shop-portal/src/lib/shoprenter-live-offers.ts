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
    parseNumber(item?.special_price) ??
    parseNumber(item?.specialPrice) ??
    parseNumber(item?.price_gross) ??
    parseNumber(item?.gross_price) ??
    parseNumber(item?.brutto_price) ??
    parseNumber(item?.price_brutto) ??
    parseNumber(item?.priceGross) ??
    parseNumber(item?.price)

  const url = resolveUrl(shopUrl, item?.url ?? item?.product_url ?? item?.productUrl ?? item?.link, sku)
  const offer: Partial<LiveOfferData> = {
    priceGross: grossPrice ?? NaN,
    availability: normalizeAvailability(item?.status ?? item?.stock_status ?? item?.availability ?? item?.in_stock),
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
  return []
}

export async function fetchLiveOffersBySku(params: {
  tenantKey: string
  rootSku: string
  relatedSkus: string[]
  connection: ConnectionInput | null
}): Promise<LiveOfferMap | null> {
  const { tenantKey, rootSku, relatedSkus, connection } = params
  if (!connection?.api_url || !connection.username || !connection.password) return null

  const cacheKey = `${tenantKey}:${rootSku}`
  const cached = offerCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) return null

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    const shopUrl = extractShopUrl(connection.api_url)
    const skuSet = new Set([rootSku, ...relatedSkus].filter(Boolean))
    const results: LiveOfferMap = {}

    const endpointCandidates = [
      `${apiBaseUrl}/products?full=1&sku=${encodeURIComponent(rootSku)}`,
      `${apiBaseUrl}/productExtend/${encodeURIComponent(rootSku)}?full=1`,
      `${apiBaseUrl}/products?full=1&limit=100&filter[sku]=${encodeURIComponent(rootSku)}`,
      `${apiBaseUrl}/products?full=1&limit=100&search=${encodeURIComponent(rootSku)}`
    ]

    for (const endpoint of endpointCandidates) {
      const payload = await fetchJson(endpoint, authHeader)
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

      const parentId = items[0]?.id
      if (parentId) {
        const variantPayload = await fetchJson(
          `${apiBaseUrl}/products?full=1&filter[parent_id]=${encodeURIComponent(parentId)}&limit=100`,
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

      if (Object.keys(results).length > 0) break
    }

    // Last resort: broad list query and match locally by SKU.
    if (Object.keys(results).length === 0) {
      const broadPayload = await fetchJson(`${apiBaseUrl}/products?full=1&limit=250`, authHeader)
      const broadItems = getItems(broadPayload)
      for (const item of broadItems) {
        const built = buildOfferFromItem(item, shopUrl)
        if (built && skuSet.has(built.sku)) {
          results[built.sku] = built.offer
        }
      }
    }

    const finalResult = Object.keys(results).length > 0 ? results : null
    offerCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: finalResult })
    return finalResult
  } catch (error) {
    offerCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: null })
    return null
  }
}
