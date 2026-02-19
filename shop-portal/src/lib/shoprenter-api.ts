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
