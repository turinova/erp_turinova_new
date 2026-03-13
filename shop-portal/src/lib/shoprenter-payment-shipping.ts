/**
 * Fetch ShopRenter payment modes and shipping mode extend for connection mapping UI.
 * Same pattern as shoprenter-tax-class: pull active options from API, map to ERP data.
 */

export interface ShopRenterPaymentMode {
  id: string
  code: string
  name: string
}

export interface ShopRenterShippingMode {
  id: string
  extension: string
  name: string
}

/**
 * Fetch active payment modes from ShopRenter (payment_mode resource).
 * GET paymentModes?full=1&limit=200; returns id, code, name (from first paymentDescription).
 */
export async function fetchShopRenterPaymentModes(
  apiBaseUrl: string,
  authHeader: string
): Promise<ShopRenterPaymentMode[]> {
  try {
    const url = `${apiBaseUrl}/paymentModes?full=1&limit=200`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to fetch paymentModes: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    const items = data.items || data.response?.items || []

    return items
      .filter((item: any) => item.status === '1')
      .map((item: any) => {
        const firstName = item.paymentDescription?.[0]?.name ?? item.code ?? item.id ?? 'Névtelen'
        return {
          id: item.id,
          code: item.code || '',
          name: typeof firstName === 'string' ? firstName : 'Névtelen'
        }
      })
  } catch (error) {
    console.error('Error fetching ShopRenter paymentModes:', error)
    throw error
  }
}

/**
 * Fetch active shipping modes from ShopRenter (shipping_mode_extend resource).
 * GET shippingModeExtend?full=1&limit=200; returns id, extension, name (from first shippingModeDescriptions).
 */
export async function fetchShopRenterShippingModeExtend(
  apiBaseUrl: string,
  authHeader: string
): Promise<ShopRenterShippingMode[]> {
  try {
    const url = `${apiBaseUrl}/shippingModeExtend?full=1&limit=200`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to fetch shippingModeExtend: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    const items = data.items || data.response?.items || []

    return items
      .filter((item: any) => item.enabled === '1')
      .map((item: any) => {
        const firstName = item.shippingModeDescriptions?.[0]?.name ?? item.extension ?? item.id ?? 'Névtelen'
        return {
          id: item.id,
          extension: item.extension || '',
          name: typeof firstName === 'string' ? firstName : 'Névtelen'
        }
      })
  } catch (error) {
    console.error('Error fetching ShopRenter shippingModeExtend:', error)
    throw error
  }
}
