import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/connections/test
 * Test a webshop connection
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { connection_type, api_url, username, password, connection_id, shop_name } = body

    if (!connection_type || !api_url || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Test connection based on type
    let testResult
    if (connection_type === 'shoprenter') {
      // For ShopRenter, username = client_id, password = client_secret
      // shop_name can be extracted from api_url or provided separately
      const extractedShopName = shop_name || extractShopNameFromUrl(api_url)
      
      if (!extractedShopName) {
        console.error('Shop name extraction failed for URL:', api_url)
        return NextResponse.json(
          { 
            error: `Shop név nem található az API URL-ből: "${api_url}". Használjon formátumot: http://shopname.api.myshoprenter.hu vagy https://shopname.api2.myshoprenter.hu` 
          },
          { status: 400 }
        )
      }
      
      console.log('Extracted shop name:', extractedShopName, 'from URL:', api_url)
      testResult = await testShopRenterConnection(extractedShopName, username, password, api_url)
    } else {
      return NextResponse.json(
        { error: `Connection type ${connection_type} not yet supported` },
        { status: 400 }
      )
    }

    // Update connection with test result if connection_id provided
    if (connection_id && testResult) {
      const { error: updateError } = await supabase
        .from('webshop_connections')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: testResult.success ? 'success' : 'failed',
          last_test_error: testResult.error || null
        })
        .eq('id', connection_id)

      if (updateError) {
        console.error('Error updating test result:', updateError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(testResult)
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json(
      { 
        success: false, 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * Extract shop name from ShopRenter API URL
 * Supports formats like:
 * - https://shopname.api2.myshoprenter.hu
 * - http://shopname.api.myshoprenter.hu
 * - https://shopname.api2.myshoprenter.hu/api
 * - shopname.api.myshoprenter.hu
 */
function extractShopNameFromUrl(apiUrl: string): string | null {
  try {
    // Remove protocol and trailing slashes
    const cleanUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    
    // Match pattern: shopname.api.myshoprenter.hu or shopname.api2.myshoprenter.hu
    const match = cleanUrl.match(/^([^.]+)\.api(2)?\.myshoprenter\.hu/)
    if (match && match[1]) {
      return match[1]
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Test ShopRenter connection using OAuth 2.0 client credentials flow
 * Based on ShopRenter API documentation:
 * 1. First acquire access token from OAuth endpoint
 * 2. Then use token to test API endpoint
 * 
 * Documentation: https://doc.shoprenter.hu/development/api/12_acquiring_an_access_token.html
 */
async function testShopRenterConnection(
  shopName: string,
  clientId: string,
  clientSecret: string,
  apiUrl?: string
): Promise<{ success: boolean; status: 'success' | 'failed'; error?: string }> {
  try {
    // Step 1: Try OAuth 2.0 client credentials flow first
    // Try multiple OAuth endpoint variations in case shop name format differs
    const oauthEndpoints = [
      `https://oauth.app.shoprenter.net/${shopName}/app/token`,
      `https://oauth.app.shoprenter.net/${shopName.toLowerCase()}/app/token`,
      `https://oauth.shoprenter.net/${shopName}/app/token`, // Alternative OAuth endpoint
      `https://oauth.shoprenter.net/${shopName.toLowerCase()}/app/token`
    ]
    
    let accessToken: string | null = null
    let tokenResponse: Response | null = null
    let lastOAuthError: string = ''
    
    // Try each OAuth endpoint
    for (const tokenUrl of oauthEndpoints) {
      try {
        console.log(`[SHOPRENTER TEST] Attempting OAuth token request for shop: ${shopName} at ${tokenUrl}`)
        
        tokenResponse = await fetch(tokenUrl, {
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
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json()
          accessToken = tokenData.access_token
          if (accessToken) {
            console.log(`[SHOPRENTER TEST] OAuth token acquired successfully from ${tokenUrl}`)
            break // Success, exit loop
          }
        } else {
          const errorData = await tokenResponse.json().catch(() => ({}))
          lastOAuthError = errorData.error_description || errorData.error || `HTTP ${tokenResponse.status}`
          console.log(`[SHOPRENTER TEST] OAuth failed at ${tokenUrl}: ${lastOAuthError}`)
          // Continue to next endpoint
          continue
        }
      } catch (oauthError: any) {
        console.log(`[SHOPRENTER TEST] OAuth request error at ${tokenUrl}:`, oauthError)
        // Check if it's a network error or something else
        if (oauthError.name === 'AbortError' || oauthError.name === 'TimeoutError') {
          lastOAuthError = `OAuth időtúllépés: ${tokenUrl}`
        } else if (oauthError.message?.includes('fetch failed') || oauthError.message?.includes('ECONNREFUSED') || oauthError.message?.includes('ENOTFOUND')) {
          lastOAuthError = `OAuth endpoint nem elérhető: ${tokenUrl}. Ellenőrizze, hogy az OAuth endpoint helyes-e.`
        } else {
          lastOAuthError = `OAuth hiba: ${oauthError.message || 'Ismeretlen hiba'}`
        }
        // Continue to next endpoint
        continue
      }
    }
    
    // If we got a token, proceed to test API
    if (accessToken) {
      // Continue to API test below
    } else {
      // All OAuth endpoints failed - try Basic Auth as fallback
      console.log(`[SHOPRENTER TEST] All OAuth endpoints failed, trying Basic Auth fallback`)
      
      if (apiUrl) {
        const basicAuthResult = await testShopRenterBasicAuth(shopName, clientId, clientSecret, apiUrl)
        
        // If Basic Auth also fails, provide a comprehensive error message
        if (!basicAuthResult.success) {
          // Check if Basic Auth got 401 (endpoint exists but auth failed) vs network errors
          const has401InBasicAuth = basicAuthResult.error?.includes('401')
          const oauthNetworkError = lastOAuthError?.includes('nem elérhető') || lastOAuthError?.includes('fetch failed')
          
          let diagnosticMessage = ''
          if (has401InBasicAuth && oauthNetworkError) {
            diagnosticMessage = ' A Basic Auth végpont elérhető, de a hitelesítés sikertelen (401). Az OAuth végpont nem elérhető. Ez azt jelenti, hogy valószínűleg Basic Auth hitelesítő adatokat használ, de azok nem helyesek, vagy az API más formátumot vár.'
          } else if (has401InBasicAuth) {
            diagnosticMessage = ' A végpont elérhető, de a hitelesítés sikertelen (401). Ellenőrizze, hogy a felhasználónév és jelszó helyes-e, és hogy nincsenek-e bennük speciális karakterek, amelyeket URL-encode-olni kell.'
          } else if (oauthNetworkError) {
            diagnosticMessage = ' Az OAuth végpont nem elérhető. Ez normális, ha az API URL `api.myshoprenter.hu` formátumú (régi API).'
          }
          
          return {
            success: false,
            status: 'failed',
            error: `OAuth és Basic Auth hitelesítés is sikertelen volt. OAuth hiba: ${lastOAuthError || 'Minden OAuth végpont sikertelen'}. Basic Auth hiba: ${basicAuthResult.error}.${diagnosticMessage} Ellenőrizze, hogy a hitelesítő adatok helyesek-e és hogy a megfelelő típusú hitelesítést használja (OAuth Client ID/Secret vagy Basic Auth felhasználónév/jelszó).`
          }
        }
        
        return basicAuthResult
      } else {
        return {
          success: false,
          status: 'failed',
          error: `OAuth hitelesítés sikertelen: ${lastOAuthError || 'Minden OAuth végpont sikertelen'}. API URL szükséges Basic Auth fallback-hez.`
        }
      }
    }
    
    // If we reach here, we have an access token - continue to API test
    if (!accessToken) {
      return {
        success: false,
        status: 'failed',
        error: 'Access token nem érkezett meg a válaszban'
      }
    }

    // Step 2: Test API endpoint using the access token
    // According to ShopRenter docs, OAuth tokens work with api2.myshoprenter.hu
    // The old api.myshoprenter.hu might not support OAuth
    // Always use api2 for OAuth-authenticated requests
    const apiBaseUrl = `https://${shopName}.api2.myshoprenter.hu/api`
    const testUrl = `${apiBaseUrl}/v1/shops`
    
    console.log(`[SHOPRENTER TEST] Testing API endpoint with OAuth token: ${testUrl}`)
    
    console.log(`[SHOPRENTER TEST] Testing API endpoint: ${testUrl}`)
    
    const apiResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (apiResponse.status === 200) {
      return { success: true, status: 'success' }
    } else if (apiResponse.status === 401) {
      return { 
        success: false, 
        status: 'failed', 
        error: 'Access token érvénytelen vagy lejárt' 
      }
    } else if (apiResponse.status === 404) {
      return { 
        success: false, 
        status: 'failed', 
        error: 'API endpoint nem található. Ellenőrizze az API URL-t.' 
      }
    } else if (apiResponse.status === 429) {
      return { 
        success: false, 
        status: 'failed', 
        error: 'Túl sok kérés. Próbálja újra később.' 
      }
    } else {
      const errorText = await apiResponse.text().catch(() => 'Unknown error')
      return { 
        success: false, 
        status: 'failed', 
        error: `API hiba (${apiResponse.status}): ${errorText.substring(0, 200)}` 
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return { 
        success: false, 
        status: 'failed', 
        error: 'Kapcsolat időtúllépés. Ellenőrizze az internetkapcsolatot.' 
      }
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return { 
        success: false, 
        status: 'failed', 
        error: 'Nem lehet csatlakozni az API-hoz. Ellenőrizze az internetkapcsolatot.' 
      }
    } else {
      return { 
        success: false, 
        status: 'failed', 
        error: error.message || 'Ismeretlen hiba történt' 
      }
    }
  }
}

/**
 * Test ShopRenter connection using Basic Auth (for old api.myshoprenter.hu API)
 * According to ShopRenter docs, Basic Auth is used with the old API endpoint:
 * - Old API: https://[shopName].api.myshoprenter.hu/products
 * - Authorization: Basic BASE64(USERNAME:PASSWORD)
 * 
 * Reference: https://doc.shoprenter.hu/development/api/12_acquiring_an_access_token.html
 */
async function testShopRenterBasicAuth(
  shopName: string,
  username: string,
  password: string,
  apiUrl: string
): Promise<{ success: boolean; status: 'success' | 'failed'; error?: string }> {
  try {
    // Normalize API URL (remove trailing slash)
    let normalizedUrl = apiUrl.replace(/\/$/, '')
    
    // According to docs, old API uses api.myshoprenter.hu (not api2)
    // Try both http and https versions
    const baseUrls = []
    if (normalizedUrl.startsWith('http://')) {
      baseUrls.push(normalizedUrl) // Keep original http
      baseUrls.push(normalizedUrl.replace('http://', 'https://')) // Also try https
    } else if (normalizedUrl.startsWith('https://')) {
      baseUrls.push(normalizedUrl) // Keep original https
      baseUrls.push(normalizedUrl.replace('https://', 'http://')) // Also try http
    } else {
      // No protocol, add both
      baseUrls.push(`http://${normalizedUrl}`)
      baseUrls.push(`https://${normalizedUrl}`)
    }
    
    // According to ShopRenter docs (12_acquiring_an_access_token.md):
    // Old API uses: https://[shopName].api.myshoprenter.hu/products
    // With: Authorization: Basic BASE64(USERNAME:PASSWORD)
    // Endpoints don't have /api prefix - they're direct resource paths
    // Try common endpoints that should work with Basic Auth
    const endpointPaths = [
      '/products',        // Products list (documented example)
      '/shops',           // Shop information  
      '/orders',          // Orders list
      '/customers',       // Customers list
      '/categories',      // Categories list
      '/setting',         // Settings (often accessible)
    ]
    
    const testEndpoints: string[] = []
    for (const baseUrl of baseUrls) {
      for (const path of endpointPaths) {
        testEndpoints.push(`${baseUrl}${path}`)
      }
    }
    
    const errors: string[] = []
    
    for (const testUrl of testEndpoints) {
      try {
        console.log(`[SHOPRENTER TEST] Trying Basic Auth on: ${testUrl}`)
        
        // Create Basic Auth header according to ShopRenter docs
        // Format: Authorization: Basic BASE64(USERNAME:PASSWORD)
        const credentials = `${username}:${password}`
        const base64Credentials = Buffer.from(credentials).toString('base64')
        const authHeader = `Basic ${base64Credentials}`
        
        console.log(`[SHOPRENTER TEST] Basic Auth on: ${testUrl}`)
        console.log(`[SHOPRENTER TEST] Username: ${username}, Password length: ${password.length}`)
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })

        console.log(`[SHOPRENTER TEST] Response status: ${response.status} for ${testUrl}`)

        if (response.status === 200) {
          console.log(`[SHOPRENTER TEST] Basic Auth successful on: ${testUrl}`)
          return { success: true, status: 'success' }
        } else if (response.status === 401) {
          const errorText = await response.text().catch(() => '')
          let errorMessage = `401 Unauthorized`
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.message || errorJson.error || errorMessage
          } catch {
            if (errorText) {
              errorMessage = errorText.substring(0, 200)
            }
          }
          errors.push(`${testUrl}: ${errorMessage}`)
          console.log(`[SHOPRENTER TEST] 401 response from ${testUrl}:`, errorMessage)
          // Continue to next endpoint
          continue
        } else if (response.status === 404) {
          // Continue to next endpoint (404 is expected for wrong paths)
          continue
        } else if (response.status >= 200 && response.status < 300) {
          // Any 2xx response is success
          console.log(`[SHOPRENTER TEST] Basic Auth successful on: ${testUrl} (status: ${response.status})`)
          return { success: true, status: 'success' }
        } else {
          const errorText = await response.text().catch(() => '')
          errors.push(`${testUrl}: ${response.status}${errorText ? ` - ${errorText.substring(0, 100)}` : ''}`)
        }
      } catch (endpointError: any) {
        // Network errors are expected for wrong URLs
        if (endpointError.name === 'AbortError' || endpointError.name === 'TimeoutError') {
          errors.push(`${testUrl}: Timeout`)
        } else if (endpointError.message?.includes('fetch failed') || endpointError.message?.includes('ECONNREFUSED')) {
          // Connection refused is expected for wrong URLs
          continue
        } else {
          errors.push(`${testUrl}: ${endpointError.message || 'Unknown error'}`)
        }
        // Try next endpoint
        continue
      }
    }
    
    // All endpoints failed - provide detailed error
    const uniqueErrors = [...new Set(errors)].slice(0, 5) // Show first 5 unique errors
    
    // Check if we got any 401 responses (which means endpoint exists but auth failed)
    const has401 = errors.some(e => e.includes('401'))
    const hasNetworkErrors = errors.some(e => e.includes('Timeout') || e.includes('ECONNREFUSED'))
    
    let errorMessage = `Basic Auth hitelesítés sikertelen minden végponton. Próbált végpontok száma: ${testEndpoints.length}.`
    
    if (has401) {
      errorMessage += ` A végpontok elérhetők, de a hitelesítés sikertelen (401). Ellenőrizze, hogy a felhasználónév és jelszó helyes-e.`
    } else if (hasNetworkErrors) {
      errorMessage += ` Hálózati hibák észlelve. Ellenőrizze az internetkapcsolatot és az API URL-t.`
    } else {
      errorMessage += ` Ellenőrizze, hogy a hitelesítő adatok helyesek-e és hogy az API URL formátuma megfelelő.`
    }
    
    errorMessage += ` Hibák: ${uniqueErrors.join('; ')}`
    
    return { 
      success: false, 
      status: 'failed', 
      error: errorMessage
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return { 
        success: false, 
        status: 'failed', 
        error: 'Kapcsolat időtúllépés. Ellenőrizze az internetkapcsolatot.' 
      }
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return { 
        success: false, 
        status: 'failed', 
        error: 'Nem lehet csatlakozni az API-hoz. Ellenőrizze az internetkapcsolatot.' 
      }
    } else {
      return { 
        success: false, 
        status: 'failed', 
        error: error.message || 'Ismeretlen hiba történt' 
      }
    }
  }
}
