import { getShopRenterAuthHeader, extractShopNameFromUrl } from './shoprenter-api'

export interface ShopRenterTaxClass {
  id: string // base64 encoded
  name: string
  description?: string
  taxRates?: Array<{
    rate: number
    name?: string
  }>
}

/**
 * Fetch all taxClasses from ShopRenter
 */
export async function fetchShopRenterTaxClasses(
  apiBaseUrl: string,
  authHeader: string
): Promise<ShopRenterTaxClass[]> {
  try {
    const url = `${apiBaseUrl}/taxClasses?full=1&limit=200`
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
      throw new Error(`Failed to fetch taxClasses: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    const items = data.items || data.response?.items || []

    return items.map((item: any) => ({
      id: item.id,
      name: item.name || 'Névtelen',
      description: item.description || null,
      taxRates: item.taxRates || []
    }))
  } catch (error) {
    console.error('Error fetching ShopRenter taxClasses:', error)
    throw error
  }
}

/**
 * Get taxClass mapping for a connection and VAT rate
 */
export async function getTaxClassMapping(
  connectionId: string,
  vatId: string,
  supabase: any
): Promise<string | null> {
  const { data, error } = await supabase
    .from('shoprenter_tax_class_mappings')
    .select('shoprenter_tax_class_id')
    .eq('connection_id', connectionId)
    .eq('vat_id', vatId)
    .single()

  if (error || !data) {
    return null
  }

  return data.shoprenter_tax_class_id
}

/**
 * Get all taxClass mappings for a connection
 */
export async function getAllTaxClassMappings(
  connectionId: string,
  supabase: any
): Promise<Array<{ vat_id: string; shoprenter_tax_class_id: string; shoprenter_tax_class_name: string | null }>> {
  const { data, error } = await supabase
    .from('shoprenter_tax_class_mappings')
    .select('vat_id, shoprenter_tax_class_id, shoprenter_tax_class_name')
    .eq('connection_id', connectionId)

  if (error || !data) {
    return []
  }

  return data
}
