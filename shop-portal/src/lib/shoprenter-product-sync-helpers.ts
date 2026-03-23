/**
 * Shared helpers for ShopRenter product sync (used by route + sync-product-db)
 */

export function extractShopNameFromUrl(apiUrl: string): string | null {
  try {
    const cleanUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const match = cleanUrl.match(/^([^.]+)\.api(2)?\.myshoprenter\.hu/)
    return match && match[1] ? match[1] : null
  } catch {
    return null
  }
}

export function constructProductUrl(shopName: string, urlAlias: string | null | undefined): string | null {
  if (!urlAlias || !urlAlias.trim()) {
    return null
  }

  if (!shopName) {
    return null
  }

  const cleanAlias = urlAlias.trim().replace(/^\//, '')
  return `https://${shopName}.shoprenter.hu/${cleanAlias}`
}

export function extractUrlAlias(product: any): { slug: string | null; id: string | null } {
  if (product.urlAliases) {
    if (typeof product.urlAliases === 'object' && product.urlAliases.urlAlias) {
      return {
        slug: product.urlAliases.urlAlias,
        id: product.urlAliases.id || null
      }
    }
    if (Array.isArray(product.urlAliases) && product.urlAliases.length > 0) {
      const firstAlias = product.urlAliases[0]
      if (firstAlias.urlAlias) {
        return {
          slug: firstAlias.urlAlias,
          id: firstAlias.id || null
        }
      }
    }
  }

  return { slug: null, id: null }
}

export async function fetchAttributeDescription(
  apiBaseUrl: string,
  authHeader: string,
  attributeId: string,
  attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT',
  languageId: string = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
): Promise<{ display_name: string | null; prefix: string | null; postfix: string | null }> {
  try {
    let queryParam = ''
    if (attributeType === 'LIST') {
      queryParam = `listAttributeId=${encodeURIComponent(attributeId)}`
    } else if (attributeType === 'TEXT') {
      queryParam = `textAttributeId=${encodeURIComponent(attributeId)}`
    } else if (attributeType === 'INTEGER' || attributeType === 'FLOAT') {
      queryParam = `numberAttributeId=${encodeURIComponent(attributeId)}`
    } else {
      return { display_name: null, prefix: null, postfix: null }
    }

    const url = `${apiBaseUrl}/attributeDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`

    console.log(`[SYNC] Fetching AttributeDescription from: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader
      },
      signal: AbortSignal.timeout(5000)
    })

    if (response.ok) {
      const data = await response.json()
      const items = data.items || data.response?.items || []

      if (items.length > 0) {
        let desc = items[0]

        if (desc.href && !desc.name && !desc.id) {
          console.log(`[SYNC] AttributeDescription item only has href, fetching full data: ${desc.href}`)
          try {
            const fullResponse = await fetch(desc.href, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: authHeader
              },
              signal: AbortSignal.timeout(5000)
            })

            if (fullResponse.ok) {
              desc = await fullResponse.json()
            }
          } catch (fetchError) {
            console.warn(`[SYNC] Failed to fetch full AttributeDescription from href:`, fetchError)
          }
        }

        console.log(
          `[SYNC] AttributeDescription response for ${attributeType} ${attributeId}:`,
          JSON.stringify(desc, null, 2).substring(0, 500)
        )

        const displayName = desc.name || null
        const prefix = desc.prefix || null
        const postfix = desc.postfix || null

        console.log(`[SYNC] Extracted from AttributeDescription: name="${displayName}", prefix="${prefix}", postfix="${postfix}"`)

        return {
          display_name: displayName,
          prefix: prefix,
          postfix: postfix
        }
      } else {
        console.warn(`[SYNC] No AttributeDescription found for ${attributeType} attribute ${attributeId} (language: ${languageId})`)
      }
    } else {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.warn(
        `[SYNC] AttributeDescription API error for ${attributeType} ${attributeId}: ${response.status} - ${errorText.substring(0, 200)}`
      )
    }
  } catch (error) {
    console.warn(`[SYNC] Failed to fetch AttributeDescription for ${attributeType} attribute ${attributeId}:`, error)
  }

  return { display_name: null, prefix: null, postfix: null }
}

export function extractParentProductId(product: any): string | null {
  if (!product.parentProduct) {
    return null
  }

  if (typeof product.parentProduct === 'object') {
    if (product.parentProduct.id) {
      return product.parentProduct.id
    }

    if (product.parentProduct.href) {
      const hrefMatch = product.parentProduct.href.match(/\/products\/([^\/\?]+)/)
      if (hrefMatch && hrefMatch[1]) {
        return hrefMatch[1]
      }
    }
  }

  if (typeof product.parentProduct === 'string') {
    return product.parentProduct
  }

  return null
}
