import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * GET /api/products/[id]/attributes/available
 * Get available attributes from Product Class that can be added to the product
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

    // Get product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        product_class_shoprenter_id,
        product_attributes,
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

    if (!product.product_class_shoprenter_id) {
      return NextResponse.json({
        success: true,
        attributes: [],
        message: 'A termékhez nincs hozzárendelt termék típus'
      })
    }

    // Get Product Class ID from database
    const { data: productClass } = await supabase
      .from('shoprenter_product_classes')
      .select('id')
      .eq('connection_id', connection.id)
      .eq('shoprenter_id', product.product_class_shoprenter_id)
      .is('deleted_at', null)
      .single()

    if (!productClass) {
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
      .eq('connection_id', connection.id)
      .eq('product_class_id', productClass.id)
      .is('deleted_at', null)

    if (relationsError) {
      console.error('[ATTRIBUTES] Error fetching attribute relations:', relationsError)
      return NextResponse.json({ error: 'Failed to fetch available attributes' }, { status: 500 })
    }

    // Get current product attributes to filter out already assigned ones
    const currentAttributes = (product.product_attributes as any[]) || []
    
    // Create sets for both IDs and names (attributes synced from ShopRenter might only have 'name')
    const assignedAttributeIds = new Set(
      currentAttributes.map(attr => {
        // Try to get the attribute ID from the attribute object
        // Priority: attribute_shoprenter_id > id > attributeId
        return attr.attribute_shoprenter_id || attr.id || attr.attributeId
      }).filter(Boolean) // Remove any undefined/null values
    )
    
    const assignedAttributeNames = new Set(
      currentAttributes.map(attr => attr.name).filter(Boolean) // Remove any undefined/null values
    )

    // Filter out already assigned attributes by comparing both IDs and names
    const availableAttributes = (attributeRelations || [])
      .filter(rel => {
        // Check if this attribute is already assigned by comparing shoprenter_id OR name
        const isAssignedById = assignedAttributeIds.has(rel.attribute_shoprenter_id)
        const isAssignedByName = assignedAttributeNames.has(rel.attribute_name || '')
        
        // Also check if any product attribute has a matching ID (even if not in the set)
        // This handles cases where attributes were synced from ShopRenter without storing IDs
        const hasMatchingAttribute = currentAttributes.some(attr => {
          const attrId = attr.attribute_shoprenter_id || attr.id || attr.attributeId
          return attrId === rel.attribute_shoprenter_id
        })
        
        if (isAssignedById || isAssignedByName || hasMatchingAttribute) {
          console.log(`[ATTRIBUTES] Filtering out already assigned attribute: ${rel.attribute_shoprenter_id} (${rel.attribute_name || 'no name'}) - matched by ${isAssignedById ? 'ID set' : isAssignedByName ? 'name' : 'matching attribute'}`)
        }
        return !isAssignedById && !isAssignedByName && !hasMatchingAttribute
      })

    // Fetch display names from ShopRenter API for attributes that don't have names
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      extractShopNameFromUrl(connection.api_url) || '',
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    // Fetch attribute descriptions for ALL attributes to get display names
    // Always fetch from ShopRenter API to get the proper display name (not internal name)
    const attributesWithDisplayNames = await Promise.all(
      availableAttributes.map(async (rel) => {
        try {
          // Use the same approach as fetchAttributeDescription in sync-products
          // Build query parameter based on attribute type (CRITICAL: different parameter names for different types)
          let queryParam = ''
          if (rel.attribute_type === 'LIST') {
            queryParam = `listAttributeId=${encodeURIComponent(rel.attribute_shoprenter_id)}`
          } else if (rel.attribute_type === 'TEXT') {
            queryParam = `textAttributeId=${encodeURIComponent(rel.attribute_shoprenter_id)}`
          } else if (rel.attribute_type === 'INTEGER' || rel.attribute_type === 'FLOAT') {
            queryParam = `numberAttributeId=${encodeURIComponent(rel.attribute_shoprenter_id)}`
          } else {
            // Unknown type, skip fetching
            return {
              id: rel.attribute_shoprenter_id,
              name: rel.attribute_name || `Attribútum (${rel.attribute_type})`,
              type: rel.attribute_type
            }
          }

          const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
          const descUrl = `${apiBaseUrl}/attributeDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
          
          console.log(`[ATTRIBUTES] Fetching AttributeDescription for ${rel.attribute_type} attribute ${rel.attribute_shoprenter_id} from: ${descUrl}`)
          
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
            
            // Get first matching description (should be only one per language)
            if (items.length > 0) {
              let desc = items[0]
              
              // If item only has href (not full data), fetch it individually
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
                  console.warn(`[ATTRIBUTES] Failed to fetch full AttributeDescription from href:`, fetchError)
                }
              }
              
              // Extract display name - according to API docs, it should be in 'name' field
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

        // Fallback: use attribute_name if available, otherwise use generic name
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
    console.error('[ATTRIBUTES] Error in GET available route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
