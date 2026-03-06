import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * GET /api/connections/[id]/list-attribute-values
 * Get all available values for a LIST attribute from ShopRenter
 * Query params: attributeId (the listAttribute shoprenter_id)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const { searchParams } = new URL(request.url)
    const attributeId = searchParams.get('attributeId')

    if (!attributeId) {
      return NextResponse.json(
        { error: 'attributeId is required' },
        { status: 400 }
      )
    }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('webshop_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('connection_type', 'shoprenter')
      .is('deleted_at', null)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
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

    // Fetch list attribute values (without languageId first to get all values)
    const listAttributeValuesUrl = `${apiBaseUrl}/listAttributeValues?listAttributeId=${encodeURIComponent(attributeId)}&full=1`
    console.log(`[LIST-ATTRIBUTE-VALUES] Fetching from: ${listAttributeValuesUrl}`)
    
    const response = await fetch(listAttributeValuesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[LIST-ATTRIBUTE-VALUES] API error ${response.status}:`, errorText)
      return NextResponse.json(
        { error: `Failed to fetch list attribute values: ${response.status}` },
        { status: response.status }
      )
    }

    const valuesData = await response.json()
    
    // Extract values from response (handle different response formats)
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
              console.warn(`[LIST-ATTRIBUTE-VALUES] Error fetching value from ${href}:`, error)
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
            const descriptions = descData.items || descData.listAttributeValueDescriptions?.listAttributeValueDescription || []
            
            // Get Hungarian description or first available
            const hungarianDesc = descriptions.find((desc: any) => 
              desc.language?.id === languageId || 
              desc.language?.id?.endsWith('bGFuZ3VhZ2VfaWQ9MQ==') ||
              desc.language?.innerId === '1' ||
              desc.language?.innerId === 1
            ) || descriptions[0]
            
            const displayValue = hungarianDesc?.name || value.value || valueId || 'Ismeretlen'
            
            return {
              id: valueId,
              value: value.value || valueId,
              displayValue: displayValue
            }
          }
        } catch (error) {
          console.warn(`[LIST-ATTRIBUTE-VALUES] Error fetching description for value ${value.id}:`, error)
        }
        
        // Fallback if description fetch fails
        return {
          id: value.id,
          value: value.value || value.id,
          displayValue: value.value || value.id || 'Ismeretlen'
        }
      })
    )

    // Filter out null values
    const formattedValues = valuesWithDescriptions.filter((v): v is { id: string; value: string; displayValue: string } => v !== null)

    return NextResponse.json({
      success: true,
      values: formattedValues
    })
  } catch (error: any) {
    console.error('[LIST-ATTRIBUTE-VALUES] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
