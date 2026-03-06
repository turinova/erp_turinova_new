import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * GET /api/products/[id]/attributes/[attributeName]/values
 * Get all available values for a LIST attribute from ShopRenter
 * SIMPLIFIED: Get attribute ID directly from product's productExtend API response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attributeName: string }> }
) {
  try {
    const { id, attributeName } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product with connection and shoprenter_id
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        shoprenter_id,
        connection_id,
        webshop_connections(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = (product as any).webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get ShopRenter API access
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json(
        { error: 'Invalid API URL format' },
        { status: 400 }
      )
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    // Check if attributeName is actually an attribute ID (base64 encoded, longer string)
    // If it looks like an ID, try to fetch listAttributeValues directly
    const isAttributeId = attributeName.length > 30 && !attributeName.includes(' ')
    
    let listAttributeId: string | null = null
    
    if (isAttributeId) {
      // attributeName is the attribute_shoprenter_id (listAttribute ID)
      // Use it directly to fetch values
      console.log(`[ATTRIBUTE-VALUES] Using attributeName as listAttribute ID: ${attributeName}`)
      listAttributeId = attributeName
    } else {
      // Try to find attribute in productExtend first
    const productExtendUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
    console.log(`[ATTRIBUTE-VALUES] Fetching productExtend from: ${productExtendUrl}`)
    
    const productExtendResponse = await fetch(productExtendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

      let productExtend: any = null
      if (productExtendResponse.ok) {
        productExtend = await productExtendResponse.json()
      } else {
        console.warn(`[ATTRIBUTE-VALUES] Failed to fetch productExtend: ${productExtendResponse.status}`)
      }
      
      const productAttributes = productExtend?.productAttributeExtend || []
    console.log(`[ATTRIBUTE-VALUES] Found ${productAttributes.length} attributes in productExtend`)
    console.log(`[ATTRIBUTE-VALUES] Looking for attribute with name: "${attributeName}"`)
    
    const attribute = productAttributes.find((attr: any) => attr.name === attributeName)

      if (attribute && attribute.type === 'LIST') {
        console.log(`[ATTRIBUTE-VALUES] Found attribute in productExtend:`, JSON.stringify(attribute, null, 2).substring(0, 500))

    // Extract listAttribute ID from the attribute
    if (attribute.listAttribute) {
      if (typeof attribute.listAttribute === 'object') {
        listAttributeId = attribute.listAttribute.id || null
        if (!listAttributeId && attribute.listAttribute.href) {
          const hrefParts = attribute.listAttribute.href.split('/')
          listAttributeId = hrefParts[hrefParts.length - 1] || null
        }
      } else if (typeof attribute.listAttribute === 'string') {
        listAttributeId = attribute.listAttribute
      }
    }

    // Fallback: Try to extract from attribute.id or attribute.href
    if (!listAttributeId) {
      listAttributeId = attribute.id || null
      if (!listAttributeId && attribute.href) {
        const hrefParts = attribute.href.split('/')
        listAttributeId = hrefParts[hrefParts.length - 1] || null
          }
        }
      }
      
      // If still not found, try to fetch the listAttribute directly using attributeName as ID
      if (!listAttributeId) {
        console.log(`[ATTRIBUTE-VALUES] Attribute not found in productExtend, trying to fetch listAttribute directly: ${attributeName}`)
        try {
          const listAttrUrl = `${apiBaseUrl}/listAttributes/${encodeURIComponent(attributeName)}?full=1`
          const listAttrResponse = await fetch(listAttrUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(5000)
          })
          
          if (listAttrResponse.ok) {
            listAttributeId = attributeName
          }
        } catch (error) {
          console.warn(`[ATTRIBUTE-VALUES] Failed to fetch listAttribute:`, error)
        }
      }
    }

    if (!listAttributeId) {
      console.error(`[ATTRIBUTE-VALUES] Could not determine listAttribute ID for "${attributeName}"`)
      return NextResponse.json({
        success: false,
        error: 'Nem sikerült meghatározni az attribútum ID-t'
      }, { status: 400 })
    }

    console.log(`[ATTRIBUTE-VALUES] Using listAttributeId: ${listAttributeId}`)

    // Fetch all listAttributeValues for this attribute
    const valuesUrl = `${apiBaseUrl}/listAttributeValues?listAttributeId=${encodeURIComponent(listAttributeId)}&full=1`
    console.log(`[ATTRIBUTE-VALUES] Fetching values from: ${valuesUrl}`)
    
    const valuesResponse = await fetch(valuesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!valuesResponse.ok) {
      console.error(`[ATTRIBUTE-VALUES] ShopRenter API error: ${valuesResponse.status} ${await valuesResponse.text()}`)
      return NextResponse.json(
        { error: `ShopRenter API hiba: ${valuesResponse.status}` },
        { status: valuesResponse.status }
      )
    }

    const valuesData = await valuesResponse.json()
    
    // Extract values from response
    let values: any[] = []
    if (valuesData.items && Array.isArray(valuesData.items)) {
      // Check if items are hrefs or full objects
      const firstItem = valuesData.items[0]
      if (firstItem && (firstItem.id || firstItem.href)) {
        // Check if items are full objects or just hrefs
        if (firstItem.id && !firstItem.href) {
          // Items are full objects
          values = valuesData.items
        } else {
          // Items are hrefs - fetch each individually
          const valueHrefs = valuesData.items
            .map((item: any) => {
              if (typeof item === 'string') return item
              return item.href || null
            })
            .filter((href: string | null): href is string => href !== null)
          
          // Fetch each value
          for (const href of valueHrefs) {
            try {
              const fullHref = href.startsWith('http') 
                ? `${href}${href.includes('?') ? '&' : '?'}full=1`
                : `${apiBaseUrl}${href.startsWith('/') ? href : `/${href}`}${href.includes('?') ? '&' : '?'}full=1`
              
              const valueResponse = await fetch(fullHref, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(5000)
              })

              if (valueResponse.ok) {
                const valueData = await valueResponse.json()
                const value = valueData.listAttributeValue || valueData
                if (value && value.id) {
                  values.push(value)
                }
              }
            } catch (error) {
              console.warn(`[ATTRIBUTE-VALUES] Error fetching value from ${href}:`, error)
            }
          }
        }
      }
    } else if (valuesData.listAttributeValue) {
      values = Array.isArray(valuesData.listAttributeValue)
        ? valuesData.listAttributeValue
        : [valuesData.listAttributeValue]
    } else if (valuesData.listAttributeValues?.listAttributeValue) {
      const listValues = valuesData.listAttributeValues.listAttributeValue
      values = Array.isArray(listValues) ? listValues : [listValues]
    }

    // Fetch descriptions for each value to get display names
    const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
    const valuesWithDescriptions = await Promise.all(
      values.map(async (value) => {
        try {
          // Get value ID
          const valueId = value.id
          if (!valueId) {
            return null
          }
          
          // Fetch descriptions for this value
          const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions?listAttributeValueId=${encodeURIComponent(valueId)}&languageId=${encodeURIComponent(languageId)}&full=1`
          const descResponse = await fetch(descUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(5000)
          })

          if (descResponse.ok) {
            const descData = await descResponse.json()
            let description: any = null
            
            // Extract description
            if (descData.items && Array.isArray(descData.items) && descData.items.length > 0) {
              description = descData.items[0]
            } else if (descData.listAttributeValueDescriptions?.listAttributeValueDescription) {
              const descs = descData.listAttributeValueDescriptions.listAttributeValueDescription
              description = Array.isArray(descs) ? descs[0] : descs
            } else if (descData.listAttributeValueDescription) {
              description = descData.listAttributeValueDescription
            } else if (descData.listAttributeValueDescription?.value) {
              description = descData.listAttributeValueDescription
            }

            // Return full object matching ShopRenter format for LIST attributes
            // This format matches what we get from productAttributeExtend during sync
            return {
              id: description?.id || valueId, // listAttributeValueDescription ID
              href: description?.href || `${apiBaseUrl}/listAttributeValueDescriptions?listAttributeValueId=${encodeURIComponent(valueId)}&languageId=${encodeURIComponent(languageId)}`,
              value: description?.value || description?.name || valueId,
              language: {
                id: languageId,
                href: `${apiBaseUrl}/languages/${languageId}`
              },
              // Also include simplified fields for easier access
              displayValue: description?.value || description?.name || valueId,
              valueId: valueId // The actual listAttributeValue ID
            }
          }
        } catch (error) {
          console.warn(`[ATTRIBUTE-VALUES] Error fetching description for value ${value.id}:`, error)
        }
        
        // Fallback if description fetch fails
        return {
          id: null, // No description ID available
          value: value.id,
          displayValue: value.id,
          valueId: value.id, // The listAttributeValue ID
          href: '',
          language: {
            id: languageId,
            href: `${apiBaseUrl}/languages/${languageId}`
          }
        }
      })
    )

    // Filter out null values
    const validValues = valuesWithDescriptions.filter(v => v !== null)

    return NextResponse.json({
      success: true,
      values: validValues
    })
  } catch (error: any) {
    console.error('[ATTRIBUTE-VALUES] Error in GET route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
