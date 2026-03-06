import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * GET /api/products/new/attributes/available
 * Get available attributes from Product Class for new products (before product is created)
 * Query params: connectionId, productClassId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const productClassId = searchParams.get('productClassId')

    if (!connectionId || !productClassId) {
      return NextResponse.json(
        { error: 'connectionId and productClassId are required' },
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

    // Get Product Class ID from database (productClassId is shoprenter_id)
    const { data: productClass, error: productClassError } = await supabase
      .from('shoprenter_product_classes')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('shoprenter_id', productClassId)
      .is('deleted_at', null)
      .single()

    if (productClassError || !productClass) {
      return NextResponse.json({
        success: true,
        attributes: [],
        message: 'A termék típus nem található az adatbázisban'
      })
    }

    // Get all attribute relations for this Product Class
    const { data: attributeRelations, error: relationsError } = await supabase
      .from('shoprenter_product_class_attribute_relations')
      .select('attribute_shoprenter_id, attribute_type, attribute_name')
      .eq('connection_id', connectionId)
      .eq('product_class_id', productClass.id)
      .is('deleted_at', null)

    if (relationsError) {
      console.error('[ATTRIBUTES] Error fetching attribute relations:', relationsError)
      return NextResponse.json({ error: 'Failed to fetch available attributes' }, { status: 500 })
    }

    // Fetch display names from ShopRenter API
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      extractShopNameFromUrl(connection.api_url) || '',
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    // Fetch attribute descriptions for ALL attributes to get display names
    const attributesWithDisplayNames = await Promise.all(
      (attributeRelations || []).map(async (rel) => {
        try {
          // Build query parameter based on attribute type
          let queryParam = ''
          if (rel.attribute_type === 'LIST') {
            queryParam = `listAttributeId=${encodeURIComponent(rel.attribute_shoprenter_id)}`
          } else if (rel.attribute_type === 'TEXT') {
            queryParam = `textAttributeId=${encodeURIComponent(rel.attribute_shoprenter_id)}`
          } else if (rel.attribute_type === 'INTEGER' || rel.attribute_type === 'FLOAT') {
            queryParam = `numberAttributeId=${encodeURIComponent(rel.attribute_shoprenter_id)}`
          } else {
            return {
              id: rel.attribute_shoprenter_id,
              name: rel.attribute_name || `Attribútum (${rel.attribute_type})`,
              type: rel.attribute_type
            }
          }

          const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
          const descUrl = `${apiBaseUrl}/attributeDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
          
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
            const items = descData.items || descData.response?.items || []
            
            if (items.length > 0) {
              let desc = items[0]
              
              // If item only has href, fetch it individually
              if (desc.href && !desc.name && !desc.id) {
                try {
                  const fullResponse = await fetch(desc.href, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(5000)
                  })
                  
                  if (fullResponse.ok) {
                    desc = await fullResponse.json()
                  }
                } catch (fetchError) {
                  console.warn(`[ATTRIBUTES] Failed to fetch full AttributeDescription:`, fetchError)
                }
              }
              
              const displayName = desc.name || null
              
              if (displayName) {
                return {
                  id: rel.attribute_shoprenter_id,
                  name: displayName,
                  type: rel.attribute_type
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[ATTRIBUTES] Failed to fetch display name for attribute ${rel.attribute_shoprenter_id}:`, error)
        }

        // Fallback
        return {
          id: rel.attribute_shoprenter_id,
          name: rel.attribute_name || `Attribútum (${rel.attribute_type})`,
          type: rel.attribute_type
        }
      })
    )

    return NextResponse.json({
      success: true,
      attributes: attributesWithDisplayNames
    })
  } catch (error: any) {
    console.error('[ATTRIBUTES] Error in GET new/available route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
