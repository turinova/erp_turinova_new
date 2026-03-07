import { Buffer } from 'buffer'

/**
 * Extract shop name from ShopRenter API URL
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

/**
 * Get OAuth access token for ShopRenter API
 */
export async function getShopRenterAccessToken(
  shopName: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string | null; error?: string }> {
  const oauthEndpoints = [
    `https://oauth.app.shoprenter.net/${shopName}/app/token`,
    `https://oauth.app.shoprenter.net/${shopName.toLowerCase()}/app/token`,
    `https://oauth.shoprenter.net/${shopName}/app/token`,
    `https://oauth.shoprenter.net/${shopName.toLowerCase()}/app/token`
  ]

  for (const tokenUrl of oauthEndpoints) {
    try {
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        }),
        signal: AbortSignal.timeout(10000)
      })

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        if (tokenData.access_token) {
          return { accessToken: tokenData.access_token }
        }
      }
    } catch (error) {
      // Continue to next endpoint
      continue
    }
  }

  return { accessToken: null, error: 'OAuth token acquisition failed' }
}

/**
 * Get authentication header for ShopRenter API
 * Tries OAuth first, falls back to Basic Auth
 */
export async function getShopRenterAuthHeader(
  shopName: string,
  username: string,
  password: string,
  apiUrl: string
): Promise<{ authHeader: string; apiBaseUrl: string; useOAuth: boolean }> {
  // Try OAuth first
  const oauthResult = await getShopRenterAccessToken(shopName, username, password)
  
  if (oauthResult.accessToken) {
    // Use OAuth with api2
    const apiBaseUrl = `https://${shopName}.api2.myshoprenter.hu/api`
    return {
      authHeader: `Bearer ${oauthResult.accessToken}`,
      apiBaseUrl,
      useOAuth: true
    }
  }

  // Fallback to Basic Auth
  const credentials = `${username}:${password}`
  const base64Credentials = Buffer.from(credentials).toString('base64')
  const authHeader = `Basic ${base64Credentials}`
  
  // Normalize API URL for Basic Auth
  let apiBaseUrl = apiUrl.replace(/\/$/, '')
  if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
    apiBaseUrl = `http://${apiBaseUrl}`
  }

  return {
    authHeader,
    apiBaseUrl,
    useOAuth: false
  }
}

/**
 * Get language ID for a language code
 * Hungarian is typically language_id = 1
 * Returns the base64 encoded ID format that ShopRenter uses
 */
export async function getLanguageId(
  apiBaseUrl: string,
  authHeader: string,
  languageCode: string = 'hu'
): Promise<string | null> {
  try {
    // Try to get language ID from ShopRenter
    const languagesUrl = `${apiBaseUrl}/languages`
    const response = await fetch(languagesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (response.ok) {
      const data = await response.json()
      const items = data.items || data.response?.items || []
      
      // Find language by code
      for (const lang of items) {
        if (lang.code === languageCode || lang.languageCode === languageCode) {
          // Extract ID from href or use id field
          if (lang.id) return lang.id
          if (lang.href) {
            const parts = lang.href.split('/')
            return parts[parts.length - 1]
          }
        }
      }
    }

    // Default to Hungarian language ID (base64 encoded "language-language_id=1")
    // This is the standard format ShopRenter uses
    if (languageCode === 'hu') {
      return 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ=='
    }

    return null
  } catch (error) {
    console.error('Error getting language ID:', error)
    // Default to Hungarian
    if (languageCode === 'hu') {
      return 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ=='
    }
    return null
  }
}

/**
 * Get or construct product description ID
 * Returns the ShopRenter product description ID, or null if it needs to be created
 */
export async function getProductDescriptionId(
  apiBaseUrl: string,
  authHeader: string,
  productId: string,
  languageId: string,
  existingDescriptionId?: string | null
): Promise<string | null> {
  // If we have existing ID, use it
  if (existingDescriptionId) {
    return existingDescriptionId
  }

  try {
    // Try to fetch product descriptions for this product
    // Use productExtend to get product with descriptions
    const productUrl = `${apiBaseUrl}/productExtend/${productId}?full=1`
    const response = await fetch(productUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (response.ok) {
      const data = await response.json()
      
      // productExtend returns product with nested productDescriptions
      // The structure can be: data.productDescriptions or data.response.productDescriptions
      // Or it might be an array directly
      let descriptions: any[] = []
      
      if (Array.isArray(data.productDescriptions)) {
        descriptions = data.productDescriptions
      } else if (data.productDescriptions?.items) {
        descriptions = data.productDescriptions.items
      } else if (data.response?.productDescriptions) {
        descriptions = Array.isArray(data.response.productDescriptions) 
          ? data.response.productDescriptions 
          : data.response.productDescriptions.items || []
      }
      
      // Find description for this language
      for (const desc of descriptions) {
        // Check if language matches - language can be an object with id/href or just an id string
        let descLanguageId: string | null = null
        if (typeof desc.language === 'string') {
          descLanguageId = desc.language
        } else if (desc.language?.id) {
          descLanguageId = desc.language.id
        } else if (desc.language?.href) {
          descLanguageId = desc.language.href.split('/').pop() || null
        }
        
        if (descLanguageId === languageId) {
          if (desc.id) return desc.id
          if (desc.href) {
            const parts = desc.href.split('/')
            return parts[parts.length - 1]
          }
        }
      }
    }

    // If not found, return null to indicate we need to create it
    return null
  } catch (error) {
    console.error('Error getting product description ID:', error)
    return null
  }
}

/**
 * Get or construct category description ID
 * Returns the ShopRenter category description ID, or null if it needs to be created
 */
export async function getCategoryDescriptionId(
  apiBaseUrl: string,
  authHeader: string,
  categoryId: string,
  languageId: string,
  existingDescriptionId?: string | null
): Promise<string | null> {
  // If we have existing ID, use it
  if (existingDescriptionId) {
    return existingDescriptionId
  }

  try {
    // Try to fetch category descriptions for this category
    // Use categoryExtend to get category with descriptions
    const categoryUrl = `${apiBaseUrl}/categoryExtend/${categoryId}?full=1`
    const response = await fetch(categoryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (response.ok) {
      const data = await response.json()
      
      // categoryExtend returns category with nested categoryDescriptions
      // The structure can be: data.categoryDescriptions or data.response.categoryDescriptions
      // Or it might be an array directly
      let descriptions: any[] = []
      
      if (Array.isArray(data.categoryDescriptions)) {
        descriptions = data.categoryDescriptions
      } else if (data.categoryDescriptions?.items) {
        descriptions = data.categoryDescriptions.items
      } else if (data.response?.categoryDescriptions) {
        descriptions = Array.isArray(data.response.categoryDescriptions) 
          ? data.response.categoryDescriptions 
          : data.response.categoryDescriptions.items || []
      }
      
      // Find description for this language
      for (const desc of descriptions) {
        // Check if language matches - language can be an object with id/href or just an id string
        let descLanguageId: string | null = null
        if (typeof desc.language === 'string') {
          descLanguageId = desc.language
        } else if (desc.language?.id) {
          descLanguageId = desc.language.id
        } else if (desc.language?.href) {
          descLanguageId = desc.language.href.split('/').pop() || null
        }
        
        if (descLanguageId === languageId) {
          if (desc.id) return desc.id
          if (desc.href) {
            const parts = desc.href.split('/')
            return parts[parts.length - 1]
          }
        }
      }
    }

    // If not found, return null to indicate we need to create it
    return null
  } catch (error) {
    console.error('Error getting category description ID:', error)
    return null
  }
}

/**
 * Sync customer group to ShopRenter
 * Creates or updates a customer group in ShopRenter and returns the ShopRenter ID
 */
export async function syncCustomerGroupToShopRenter(
  apiBaseUrl: string,
  authHeader: string,
  customerGroup: {
    id: string
    name: string
    code: string
    shoprenter_customer_group_id: string | null
  }
): Promise<{ shoprenterId: string | null; error?: string }> {
  try {
    // If we already have a ShopRenter ID, try to update
    if (customerGroup.shoprenter_customer_group_id) {
      try {
        const updateResponse = await fetch(
          `${apiBaseUrl}/customerGroups/${customerGroup.shoprenter_customer_group_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              name: customerGroup.name,
              percentDiscount: '0',
              percentDiscountSpecialPrices: '0'
            }),
            signal: AbortSignal.timeout(10000)
          }
        )

        if (updateResponse.ok) {
          const result = await updateResponse.json().catch(() => null)
          const shoprenterId = result?.id || customerGroup.shoprenter_customer_group_id
          return { shoprenterId }
        }
      } catch (error) {
        console.warn(`[SYNC] Failed to update customer group in ShopRenter:`, error)
        // Continue to try creating
      }
    }

    // Try to find existing customer group by name
    try {
      const searchResponse = await fetch(`${apiBaseUrl}/customerGroups?full=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(10000)
      })

      if (searchResponse.ok) {
        const searchData = await searchResponse.json().catch(() => null)
        const items = searchData?.items || searchData?.response?.items || []
        
        // Find by name (case-insensitive)
        const existing = items.find((item: any) => 
          item.name?.toLowerCase() === customerGroup.name.toLowerCase()
        )
        
        if (existing) {
          const shoprenterId = existing.id || existing.href?.split('/').pop()
          if (shoprenterId) {
            return { shoprenterId }
          }
        }
      }
    } catch (error) {
      console.warn(`[SYNC] Failed to search for existing customer group:`, error)
    }

    // Create new customer group
    const createResponse = await fetch(`${apiBaseUrl}/customerGroups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        name: customerGroup.name,
        percentDiscount: '0',
        percentDiscountSpecialPrices: '0'
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (createResponse.ok) {
      const result = await createResponse.json().catch(() => null)
      const shoprenterId = result?.id || result?.href?.split('/').pop()
      if (shoprenterId) {
        return { shoprenterId }
      }
    }

    const errorText = await createResponse.text().catch(() => 'Unknown error')
    return { shoprenterId: null, error: `Failed to create customer group: ${createResponse.status} - ${errorText}` }
  } catch (error) {
    console.error('Error syncing customer group to ShopRenter:', error)
    return { shoprenterId: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Sync customer group price to ShopRenter
 * Creates or updates a customer group product price in ShopRenter
 */
export async function syncCustomerGroupPriceToShopRenter(
  apiBaseUrl: string,
  authHeader: string,
  productShopRenterId: string,
  customerGroupShopRenterId: string,
  price: number,
  existingShopRenterPriceId: string | null
): Promise<{ shoprenterId: string | null; error?: string }> {
  try {
    // If we have an existing ShopRenter price ID, try to update
    if (existingShopRenterPriceId) {
      try {
        const updateResponse = await fetch(
          `${apiBaseUrl}/customerGroupProductPrices/${existingShopRenterPriceId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              price: price.toString(),
              customerGroup: {
                id: customerGroupShopRenterId
              },
              product: {
                id: productShopRenterId
              }
            }),
            signal: AbortSignal.timeout(10000)
          }
        )

        if (updateResponse.ok) {
          const result = await updateResponse.json().catch(() => null)
          const shoprenterId = result?.id || existingShopRenterPriceId
          return { shoprenterId }
        }
      } catch (error) {
        console.warn(`[SYNC] Failed to update customer group price in ShopRenter:`, error)
        // Continue to try creating
      }
    }

    // Try to find existing price
    try {
      const searchResponse = await fetch(
        `${apiBaseUrl}/customerGroupProductPrices?productId=${encodeURIComponent(productShopRenterId)}&full=1`,
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

      if (searchResponse.ok) {
        const searchData = await searchResponse.json().catch(() => null)
        const items = searchData?.items || searchData?.response?.items || []
        
        // Find by customer group ID
        const existing = items.find((item: any) => {
          const itemGroupId = item.customerGroup?.id || item.customerGroup?.href?.split('/').pop()
          return itemGroupId === customerGroupShopRenterId
        })
        
        if (existing) {
          const shoprenterId = existing.id || existing.href?.split('/').pop()
          if (shoprenterId) {
            // Update it
            const updateResponse = await fetch(
              `${apiBaseUrl}/customerGroupProductPrices/${shoprenterId}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify({
                  price: price.toString(),
                  customerGroup: {
                    id: customerGroupShopRenterId
                  },
                  product: {
                    id: productShopRenterId
                  }
                }),
                signal: AbortSignal.timeout(10000)
              }
            )

            if (updateResponse.ok) {
              return { shoprenterId }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[SYNC] Failed to search for existing customer group price:`, error)
    }

    // Create new customer group price
    const createResponse = await fetch(`${apiBaseUrl}/customerGroupProductPrices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        price: price.toString(),
        customerGroup: {
          id: customerGroupShopRenterId
        },
        product: {
          id: productShopRenterId
        }
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (createResponse.ok) {
      const result = await createResponse.json().catch(() => null)
      const shoprenterId = result?.id || result?.href?.split('/').pop()
      if (shoprenterId) {
        return { shoprenterId }
      }
    }

    const errorText = await createResponse.text().catch(() => 'Unknown error')
    return { shoprenterId: null, error: `Failed to create customer group price: ${createResponse.status} - ${errorText}` }
  } catch (error) {
    console.error('Error syncing customer group price to ShopRenter:', error)
    return { shoprenterId: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Sync product special (promotion) to ShopRenter
 * Creates or updates a productSpecial in ShopRenter
 */
export async function syncProductSpecialToShopRenter(
  apiBaseUrl: string,
  authHeader: string,
  productShopRenterId: string,
  promotion: {
    priority: number
    price: number
    dateFrom: string | null
    dateTo: string | null
    minQuantity: number
    maxQuantity: number
    type?: 'interval' | 'day_spec'
    dayOfWeek?: number | null
    customerGroupShopRenterId?: string | null
  },
  existingShopRenterSpecialId: string | null
): Promise<{ shoprenterId: string | null; error?: string }> {
  try {
    // Build payload
    const payload: any = {
      priority: promotion.priority.toString(),
      price: promotion.price.toFixed(4),
      product: {
        id: productShopRenterId
      }
    }

    // Add date range (ShopRenter format: YYYY-MM-DD)
    if (promotion.dateFrom) {
      payload.dateFrom = promotion.dateFrom
    }
    if (promotion.dateTo) {
      payload.dateTo = promotion.dateTo
    }

    // Add quantity range
    payload.minQuantity = promotion.minQuantity.toString()
    payload.maxQuantity = promotion.maxQuantity.toString()

    // Add customer group (null = "Everyone")
    if (promotion.customerGroupShopRenterId) {
      payload.customerGroup = {
        id: promotion.customerGroupShopRenterId
      }
    }

    // Add product of day fields
    if (promotion.type === 'day_spec') {
      payload.type = 'day_spec'
      if (promotion.dayOfWeek) {
        payload.dayOfWeek = promotion.dayOfWeek.toString()
      }
    }

    // If we have an existing ShopRenter special ID, try to update
    if (existingShopRenterSpecialId) {
      try {
        const updateResponse = await fetch(
          `${apiBaseUrl}/productSpecials/${existingShopRenterSpecialId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
          }
        )

        if (updateResponse.ok) {
          const result = await updateResponse.json().catch(() => null)
          const shoprenterId = result?.id || existingShopRenterSpecialId
          return { shoprenterId }
        }

        // If update fails with 404, the promotion was deleted in ShopRenter, create new
        if (updateResponse.status === 404) {
          console.log(`[SYNC] Promotion ${existingShopRenterSpecialId} not found in ShopRenter, creating new`)
        } else {
          const errorText = await updateResponse.text().catch(() => 'Unknown error')
          console.warn(`[SYNC] Failed to update promotion in ShopRenter: ${updateResponse.status} - ${errorText}`)
        }
      } catch (error) {
        console.warn(`[SYNC] Failed to update promotion in ShopRenter:`, error)
        // Continue to try creating
      }
    }

    // Create new promotion
    console.log(`[SYNC] Creating promotion in ShopRenter for product: ${productShopRenterId}`)
    console.log(`[SYNC] Promotion payload:`, JSON.stringify(payload, null, 2))
    
    const createResponse = await fetch(`${apiBaseUrl}/productSpecials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    })

    console.log(`[SYNC] Promotion create response status: ${createResponse.status}`)

    if (createResponse.ok) {
      const responseText = await createResponse.text().catch(() => '')
      console.log(`[SYNC] Promotion create response body (raw):`, responseText)
      
      let result: any = null
      try {
        result = JSON.parse(responseText)
        console.log(`[SYNC] Promotion create response (parsed):`, result)
      } catch (parseError) {
        console.error(`[SYNC] ⚠️ Failed to parse response as JSON:`, parseError)
        console.error(`[SYNC] Response text:`, responseText)
      }
      
      // Try multiple ways to extract the ShopRenter ID
      let shoprenterId: string | null = null
      
      if (result?.id) {
        shoprenterId = result.id
      } else if (result?.href) {
        // Extract ID from href: http://shop.api.myshoprenter.hu/productSpecials/cHJvZHVjdFNwZWNpYWwt...
        const hrefParts = result.href.split('/')
        shoprenterId = hrefParts[hrefParts.length - 1] || null
      } else if (responseText) {
        // Try to extract from raw text if JSON parsing failed but we have text
        const idMatch = responseText.match(/productSpecials[\/"]([^"\/]+)/)
        if (idMatch && idMatch[1]) {
          shoprenterId = idMatch[1]
        }
      }
      
      if (shoprenterId) {
        console.log(`[SYNC] ✅ Promotion created successfully in ShopRenter: ${shoprenterId}`)
        return { shoprenterId }
      } else {
        console.warn(`[SYNC] ⚠️ Promotion created but no ID returned in response`)
        console.warn(`[SYNC] Response object:`, result)
        console.warn(`[SYNC] Response text:`, responseText.substring(0, 500))
        console.warn(`[SYNC] Attempted to extract ID from:`, { 
          id: result?.id, 
          href: result?.href,
          status: createResponse.status,
          statusText: createResponse.statusText
        })
        // Even if we can't extract ID, if status is 200/201, the creation was successful
        // Return error so caller knows to retry or check manually
        return { 
          shoprenterId: null, 
          error: 'Promotion created in ShopRenter but ID could not be extracted from response. Please sync manually.' 
        }
      }
    }

    // Handle 409 conflict (promotion already exists)
    if (createResponse.status === 409) {
      try {
        const errorData = await createResponse.json().catch(() => null)
        if (errorData?.id) {
          // Extract ID from error response
          const existingId = errorData.id
          console.log(`[SYNC] Promotion already exists in ShopRenter: ${existingId}, updating instead`)
          
          // Try to update with the existing ID
          const updateResponse = await fetch(
            `${apiBaseUrl}/productSpecials/${existingId}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(10000)
            }
          )

          if (updateResponse.ok) {
            return { shoprenterId: existingId }
          }
        }
      } catch (error) {
        console.warn(`[SYNC] Failed to handle 409 conflict:`, error)
      }
    }

    const errorText = await createResponse.text().catch(() => 'Unknown error')
    console.error(`[SYNC] ❌ Failed to create promotion in ShopRenter. Status: ${createResponse.status}, Error: ${errorText}`)
    return { shoprenterId: null, error: `Failed to create promotion: ${createResponse.status} - ${errorText}` }
  } catch (error) {
    console.error('Error syncing promotion to ShopRenter:', error)
    return { shoprenterId: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Delete product special from ShopRenter
 */
export async function deleteProductSpecialFromShopRenter(
  apiBaseUrl: string,
  authHeader: string,
  shoprenterSpecialId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const deleteResponse = await fetch(
      `${apiBaseUrl}/productSpecials/${shoprenterSpecialId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(10000)
      }
    )

    if (deleteResponse.ok || deleteResponse.status === 204 || deleteResponse.status === 404) {
      return { success: true }
    }

    const errorText = await deleteResponse.text().catch(() => 'Unknown error')
    return { success: false, error: `Failed to delete promotion: ${deleteResponse.status} - ${errorText}` }
  } catch (error) {
    console.error('Error deleting promotion from ShopRenter:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
