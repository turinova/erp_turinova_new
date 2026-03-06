import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'

/**
 * GET /api/connections/[id]/attributes
 * Fetch available product attributes from ShopRenter API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(id)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json(
        { error: 'Kapcsolat nem található vagy érvénytelen típus' },
        { status: 404 }
      )
    }

    if (!connection.is_active || !connection.username || !connection.password) {
      return NextResponse.json(
        { error: 'A kapcsolat inaktív vagy hiányoznak a hitelesítési adatok' },
        { status: 400 }
      )
    }

    // Prepare API call
    const credentials = `${connection.username}:${connection.password}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${base64Credentials}`

    let apiUrl = connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

    // Fetch attributes from ShopRenter
    const attributesUrl = `${apiUrl}/attributes?limit=100`
    const response = await fetch(attributesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Hitelesítési hiba. Ellenőrizze a kapcsolat beállításait.' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: `ShopRenter API hiba: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const attributes = data.attributes?.attribute || []

    // Fetch attribute descriptions for each attribute
    const attributesWithDescriptions = await Promise.all(
      attributes.map(async (attr: any) => {
        try {
          // Fetch attribute descriptions
          const descUrl = attr.attributeDescriptions?.href
          if (!descUrl) {
            return {
              name: attr.name || '',
              display_name: attr.name || '',
              type: attr.type || 'TEXT',
              prefix: attr.prefix || null,
              postfix: attr.postfix || null,
              values: []
            }
          }

          let fullDescUrl = descUrl
          if (descUrl.startsWith('http://') || descUrl.startsWith('https://')) {
            fullDescUrl = descUrl
          } else if (descUrl.startsWith('/')) {
            fullDescUrl = `${apiUrl}${descUrl}`
          } else {
            fullDescUrl = `${apiUrl}/${descUrl}`
          }

          const descResponse = await fetch(fullDescUrl, {
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
            const descriptions = descData.attributeDescriptions?.attributeDescription || []
            
            // Get Hungarian description (language_id = 1) or first available
            const huDesc = descriptions.find((d: any) => 
              d.language?.innerId === '1' || d.language?.innerId === 1
            ) || descriptions[0]

            // For LIST type, fetch attribute values
            let values: any[] = []
            if (attr.type === 'LIST' && attr.attributeValues?.href) {
              try {
                let valuesUrl = attr.attributeValues.href
                if (!valuesUrl.startsWith('http://') && !valuesUrl.startsWith('https://')) {
                  valuesUrl = valuesUrl.startsWith('/') 
                    ? `${apiUrl}${valuesUrl}`
                    : `${apiUrl}/${valuesUrl}`
                }

                const valuesResponse = await fetch(valuesUrl, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(5000)
                })

                if (valuesResponse.ok) {
                  const valuesData = await valuesResponse.json()
                  const attributeValues = valuesData.attributeValues?.attributeValue || []
                  
                  // Fetch value descriptions
                  values = await Promise.all(
                    attributeValues.map(async (val: any) => {
                      if (val.attributeValueDescriptions?.href) {
                        try {
                          let valDescUrl = val.attributeValueDescriptions.href
                          if (!valDescUrl.startsWith('http://') && !valDescUrl.startsWith('https://')) {
                            valDescUrl = valDescUrl.startsWith('/')
                              ? `${apiUrl}${valDescUrl}`
                              : `${apiUrl}/${valDescUrl}`
                          }

                          const valDescResponse = await fetch(valDescUrl, {
                            method: 'GET',
                            headers: {
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                              'Authorization': authHeader
                            },
                            signal: AbortSignal.timeout(5000)
                          })

                          if (valDescResponse.ok) {
                            const valDescData = await valDescResponse.json()
                            const valDescriptions = valDescData.attributeValueDescriptions?.attributeValueDescription || []
                            const huValDesc = valDescriptions.find((d: any) =>
                              d.language?.innerId === '1' || d.language?.innerId === 1
                            ) || valDescriptions[0]

                            return {
                              id: val.id,
                              value: huValDesc?.value || val.id,
                              language: valDescData.language
                            }
                          }
                        } catch (error) {
                          console.error(`Error fetching value description for ${val.id}:`, error)
                        }
                      }
                      return {
                        id: val.id,
                        value: val.id,
                        language: null
                      }
                    })
                  )
                }
              } catch (error) {
                console.error('Error fetching attribute values:', error)
              }
            }

            return {
              name: attr.name || '',
              display_name: huDesc?.name || attr.name || '',
              type: attr.type || 'TEXT',
              prefix: attr.prefix || null,
              postfix: attr.postfix || null,
              values: values
            }
          }
        } catch (error) {
          console.error(`Error fetching description for attribute ${attr.name}:`, error)
        }

        return {
          name: attr.name || '',
          display_name: attr.name || '',
          type: attr.type || 'TEXT',
          prefix: attr.prefix || null,
          postfix: attr.postfix || null,
          values: []
        }
      })
    )

    return NextResponse.json({
      success: true,
      attributes: attributesWithDescriptions
    })
  } catch (error) {
    console.error('Error in attributes route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
