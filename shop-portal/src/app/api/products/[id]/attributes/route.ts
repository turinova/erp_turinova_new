import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * POST /api/products/[id]/attributes
 * Add a new attribute to the product (stored locally, synced on manual sync)
 */
export async function POST(
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

    const body = await request.json()
    const { attributeId, attributeType, value } = body

    if (!attributeId || !attributeType || value === undefined) {
      return NextResponse.json(
        { error: 'attributeId, attributeType, and value are required' },
        { status: 400 }
      )
    }

    // Get product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('product_attributes')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get attribute details from Product Class relations
    const { data: productData } = await supabase
      .from('shoprenter_products')
      .select(`
        connection_id,
        webshop_connections(*)
      `)
      .eq('id', id)
      .single()

    const connection = (productData as any)?.webshop_connections
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Get attribute relation to find internal name
    const { data: attributeRelation } = await supabase
      .from('shoprenter_product_class_attribute_relations')
      .select('attribute_name, attribute_type')
      .eq('connection_id', connection.id)
      .eq('attribute_shoprenter_id', attributeId)
      .is('deleted_at', null)
      .maybeSingle()

    // Fetch display name from ShopRenter API
    let displayName: string | null = null
    try {
      const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
        extractShopNameFromUrl(connection.api_url) || '',
        connection.username || '',
        connection.password || '',
        connection.api_url
      )

      // Build query parameter based on attribute type (same as fetchAttributeDescription)
      let queryParam = ''
      if (attributeType === 'LIST') {
        queryParam = `listAttributeId=${encodeURIComponent(attributeId)}`
      } else if (attributeType === 'TEXT') {
        queryParam = `textAttributeId=${encodeURIComponent(attributeId)}`
      } else if (attributeType === 'INTEGER' || attributeType === 'FLOAT') {
        queryParam = `numberAttributeId=${encodeURIComponent(attributeId)}`
      }

      if (queryParam) {
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
            
            displayName = desc.name || null
          }
        }
      }
    } catch (error) {
      console.warn(`[ATTRIBUTES] Failed to fetch display name for attribute ${attributeId}:`, error)
    }

    const currentAttributes = (product.product_attributes as any[]) || []
    
    // Use internal name for matching (attribute_name from relation)
    const internalName = attributeRelation?.attribute_name || attributeId
    
    // Check if attribute already exists (match by internal name or ID)
    const existingIndex = currentAttributes.findIndex(attr => 
      attr.name === internalName || 
      attr.id === attributeId || 
      attr.attribute_shoprenter_id === attributeId
    )
    if (existingIndex >= 0) {
      // Update existing attribute
      currentAttributes[existingIndex].value = value
      // Update display_name if we fetched it
      if (displayName) {
        currentAttributes[existingIndex].display_name = displayName
      }
      // Ensure ID is stored
      if (!currentAttributes[existingIndex].id && !currentAttributes[existingIndex].attribute_shoprenter_id) {
        currentAttributes[existingIndex].id = attributeId
        currentAttributes[existingIndex].attribute_shoprenter_id = attributeId
      }
    } else {
      // Add new attribute
      currentAttributes.push({
        type: attributeType,
        name: internalName, // Internal identifier for matching
        id: attributeId, // Store attribute_shoprenter_id for filtering
        attribute_shoprenter_id: attributeId, // Also store as attribute_shoprenter_id for consistency
        display_name: displayName, // Display name from ShopRenter (e.g., "Csepegtetőtálca")
        group_name: null, // Will be set from Product Class during sync
        value: value,
        prefix: null,
        postfix: null
      })
    }

    // Update product with new attributes
    const { error: updateError } = await supabase
      .from('shoprenter_products')
      .update({
        product_attributes: currentAttributes,
        sync_status: 'pending', // Mark for sync
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[ATTRIBUTES] Error updating product:', updateError)
      return NextResponse.json(
        { error: 'Failed to add attribute' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Attribútum hozzáadva. A változások szinkronizálása szükséges.'
    })
  } catch (error: any) {
    console.error('[ATTRIBUTES] Error in POST route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/products/[id]/attributes
 * Update an attribute value (stored locally, synced on manual sync)
 */
export async function PUT(
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

    const body = await request.json()
    const { attributeName, value } = body

    if (!attributeName || value === undefined) {
      return NextResponse.json(
        { error: 'attributeName and value are required' },
        { status: 400 }
      )
    }

    // Get product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('product_attributes')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const currentAttributes = (product.product_attributes as any[]) || []
    const attributeIndex = currentAttributes.findIndex(attr => attr.name === attributeName)

    if (attributeIndex < 0) {
      return NextResponse.json(
        { error: 'Attribute not found' },
        { status: 404 }
      )
    }

    // Update attribute value
    currentAttributes[attributeIndex].value = value

    // Update product
    const { error: updateError } = await supabase
      .from('shoprenter_products')
      .update({
        product_attributes: currentAttributes,
        sync_status: 'pending', // Mark for sync
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[ATTRIBUTES] Error updating product:', updateError)
      return NextResponse.json(
        { error: 'Failed to update attribute' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Attribútum frissítve. A változások szinkronizálása szükséges.'
    })
  } catch (error: any) {
    console.error('[ATTRIBUTES] Error in PUT route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id]/attributes
 * Remove an attribute from the product (stored locally, synced on manual sync)
 */
export async function DELETE(
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

    const { searchParams } = new URL(request.url)
    const attributeName = searchParams.get('attributeName')

    if (!attributeName) {
      return NextResponse.json(
        { error: 'attributeName is required' },
        { status: 400 }
      )
    }

    // Get product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('product_attributes')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const currentAttributes = (product.product_attributes as any[]) || []
    const filteredAttributes = currentAttributes.filter(attr => attr.name !== attributeName)

    if (filteredAttributes.length === currentAttributes.length) {
      return NextResponse.json(
        { error: 'Attribute not found' },
        { status: 404 }
      )
    }

    // Update product
    const { error: updateError } = await supabase
      .from('shoprenter_products')
      .update({
        product_attributes: filteredAttributes,
        sync_status: 'pending', // Mark for sync
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[ATTRIBUTES] Error updating product:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove attribute' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Attribútum eltávolítva. A változások szinkronizálása szükséges.'
    })
  } catch (error: any) {
    console.error('[ATTRIBUTES] Error in DELETE route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
