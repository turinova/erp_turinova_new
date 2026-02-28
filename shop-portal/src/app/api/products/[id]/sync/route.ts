import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  getLanguageId,
  getProductDescriptionId
} from '@/lib/shoprenter-api'

/**
 * POST /api/products/[id]/sync
 * Sync product TO ShopRenter (push local changes) and then pull back to verify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Get product with description and tags
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*),
        shoprenter_product_descriptions(*),
        product_tags(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = product.webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get Hungarian description (or first available)
    const descriptions = product.shoprenter_product_descriptions || []
    const huDescription = descriptions.find((d: any) => d.language_code === 'hu') || descriptions[0]
    
    if (!huDescription) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nincs leírás a termékhez. Kérjük, mentse el a leírást először.' 
      }, { status: 400 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    // Get authentication
    const { authHeader, apiBaseUrl, useOAuth } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get language ID
    const languageId = await getLanguageId(apiBaseUrl, authHeader, 'hu')
    if (!languageId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nem sikerült meghatározni a nyelv azonosítóját' 
      }, { status: 500 })
    }

    // Get product description ID
    const descriptionId = await getProductDescriptionId(
      apiBaseUrl,
      authHeader,
      product.shoprenter_id,
      languageId,
      huDescription.shoprenter_id
    )

    // First, update product basic data (modelNumber, gtin, pricing) if changed
    const productPayload: any = {}
    
    // Add modelNumber if exists
    if (product.model_number !== null && product.model_number !== undefined) {
      productPayload.modelNumber = product.model_number || ''
    }
    
    // Add gtin (barcode) if exists
    if (product.gtin !== null && product.gtin !== undefined) {
      productPayload.gtin = product.gtin || ''
    }
    
    // Edge case handling for PUSH (ERP → ShopRenter)
    let priceToSend: number | null = product.price ? parseFloat(product.price.toString()) : null
    const cost = product.cost ? parseFloat(product.cost.toString()) : null
    const multiplier = product.multiplier ? parseFloat(product.multiplier.toString()) : 1.0

    // Case 4: No price, but has cost and multiplier -> calculate price
    if (!priceToSend || priceToSend <= 0) {
      if (cost && cost > 0 && multiplier > 0) {
        priceToSend = cost * multiplier
        console.log(`[SYNC] Calculated price from cost × multiplier: ${priceToSend.toFixed(2)} (cost: ${cost}, multiplier: ${multiplier})`)
      } else {
        console.warn(`[SYNC] ⚠️ Cannot sync product ${product.sku}: No price and cannot calculate from cost/multiplier`)
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot sync product without price. Please set a price or provide both cost and multiplier.' 
        }, { status: 400 })
      }
    } else {
      // Case 2 & 3: Has price, missing cost or multiplier -> calculate missing one for validation
      let calculatedCost = cost
      let calculatedMultiplier = multiplier
      
      if (cost && cost > 0 && (!multiplier || multiplier === 1.0)) {
        calculatedMultiplier = priceToSend / cost
        console.log(`[SYNC] Calculated multiplier for validation: ${calculatedMultiplier.toFixed(3)} (price: ${priceToSend}, cost: ${cost})`)
      } else if (!cost && multiplier > 0 && multiplier !== 1.0) {
        calculatedCost = priceToSend / multiplier
        console.log(`[SYNC] Calculated cost for validation: ${calculatedCost.toFixed(2)} (price: ${priceToSend}, multiplier: ${multiplier})`)
      }
      
      // Case 5: Validate consistency
      if (calculatedCost && calculatedCost > 0 && calculatedMultiplier > 0) {
        const expectedPrice = calculatedCost * calculatedMultiplier
        const difference = Math.abs(priceToSend - expectedPrice)
        
        if (difference > 0.01) {
          console.warn(`[SYNC] ⚠️ Price mismatch before sync: cost (${calculatedCost}) × multiplier (${calculatedMultiplier}) = ${expectedPrice.toFixed(2)}, but price is ${priceToSend}`)
          // Fix price to match cost × multiplier before sending (ensures consistency)
          priceToSend = expectedPrice
          console.log(`[SYNC] Fixed price to match cost × multiplier: ${priceToSend.toFixed(2)}`)
        }
      }
    }

    // Add pricing fields
    // IMPORTANT: ShopRenter calculates: price * multiplier * VAT
    // In ERP: cost * multiplier = price (net price already includes multiplier)
    // So we send net price to ShopRenter and set multiplier to 1.0 to avoid double calculation
    if (priceToSend !== null && priceToSend !== undefined) {
      productPayload.price = String(priceToSend)
    }
    // Cost is informational only, not synced to ShopRenter
    // Multiplier is set to 1.0 because the net price already includes it
    // This prevents ShopRenter from calculating: (cost * multiplier) * multiplier * VAT
    productPayload.multiplier = '1.0'
    productPayload.multiplierLock = '1' // Lock multiplier at 1.0

    // Add taxClass if VAT is set
    const vatId = (product as any).vat_id
    if (vatId) {
      // Get taxClass mapping
      const { data: mapping, error: mappingError } = await supabase
        .from('shoprenter_tax_class_mappings')
        .select('shoprenter_tax_class_id, shoprenter_tax_class_name')
        .eq('connection_id', connection.id)
        .eq('vat_id', vatId)
        .single()
      
      if (mapping && mapping.shoprenter_tax_class_id) {
        productPayload.taxClass = {
          id: mapping.shoprenter_tax_class_id
        }
        console.log(`[SYNC] Mapped VAT ${vatId} to ShopRenter taxClass ${mapping.shoprenter_tax_class_id} (${mapping.shoprenter_tax_class_name || 'Unknown'})`)
      } else {
        console.warn(`[SYNC] ⚠️ WARNING: No taxClass mapping found for vat_id: ${vatId}`)
        console.warn(`[SYNC] Product will sync without taxClass - ShopRenter will use default taxClass`)
        // Don't fail sync, but log warning
      }
    }

    // Log pricing sync
    console.log(`[SYNC] Syncing net price: ${priceToSend} (${priceToSend !== product.price ? 'calculated/fixed from cost × multiplier' : 'original price, already includes multiplier from ERP'})`)
    console.log(`[SYNC] Setting ShopRenter multiplier to 1.0 to avoid double calculation`)
    if (cost !== null && cost !== undefined) {
      console.log(`[SYNC] Cost (informational only, not synced): ${cost}`)
    }
    if (multiplier !== null && multiplier !== undefined) {
      console.log(`[SYNC] ERP multiplier (informational only, not synced): ${multiplier}`)
    }
    
    // Only update if there's something to update
    if (Object.keys(productPayload).length > 0) {
      const productUpdateUrl = `${apiBaseUrl}/products/${product.shoprenter_id}`
      console.log(`[SYNC] Updating product data: PUT ${productUpdateUrl}`)
      console.log(`[SYNC] Product payload:`, JSON.stringify(productPayload))
      
      const productUpdateResponse = await fetch(productUpdateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(productPayload),
        signal: AbortSignal.timeout(30000)
      })

      if (!productUpdateResponse.ok) {
        const errorText = await productUpdateResponse.text().catch(() => 'Unknown error')
        console.warn(`[SYNC] Product data update failed: ${productUpdateResponse.status} - ${errorText.substring(0, 200)}`)
        // Continue with description sync even if product update fails
      } else {
        console.log(`[SYNC] Product data updated successfully`)
      }
    }

    // Prepare payload for ShopRenter
    // Note: For empty strings, we send empty string (not null) to delete in ShopRenter
    const payload: any = {
      name: huDescription.name || product.name || '',
      // Send empty string if meta fields are empty/null to delete in ShopRenter
      metaTitle: huDescription.meta_title && huDescription.meta_title.trim().length > 0
        ? huDescription.meta_title.trim()
        : '', // Empty string will delete metaTitle in ShopRenter
      metaKeywords: huDescription.meta_keywords && huDescription.meta_keywords.trim().length > 0
        ? huDescription.meta_keywords.trim()
        : '', // Empty string will delete metaKeywords in ShopRenter
      metaDescription: huDescription.meta_description && huDescription.meta_description.trim().length > 0
        ? huDescription.meta_description.trim()
        : '', // Empty string will delete metaDescription in ShopRenter
      // Send empty string if descriptions are empty/null to delete in ShopRenter
      shortDescription: huDescription.short_description && huDescription.short_description.trim().length > 0
        ? huDescription.short_description.trim()
        : '', // Empty string will delete shortDescription in ShopRenter
      description: huDescription.description && huDescription.description.trim().length > 0
        ? huDescription.description.trim()
        : '', // Empty string will delete description in ShopRenter
      // Send empty string if parameters is empty/null to delete in ShopRenter
      parameters: huDescription.parameters && huDescription.parameters.trim().length > 0 
        ? huDescription.parameters.trim() 
        : '', // Empty string will delete parameters in ShopRenter
      product: {
        id: product.shoprenter_id
      },
      language: {
        id: languageId
      }
    }

    // Note: We keep all fields (including empty strings) to ensure deletion in ShopRenter
    // Empty strings will delete the corresponding fields in ShopRenter

    // Determine endpoint - use PUT if we have description ID, POST if not
    let updateUrl: string
    let method: string

    if (descriptionId) {
      // Update existing description
      updateUrl = `${apiBaseUrl}/productDescriptions/${descriptionId}`
      method = 'PUT'
    } else {
      // Create new description
      updateUrl = `${apiBaseUrl}/productDescriptions`
      method = 'POST'
    }

    console.log(`[SYNC] ${method} ${updateUrl}`)
    console.log(`[SYNC] Payload:`, JSON.stringify(payload, null, 2).substring(0, 500))

    // Push to ShopRenter
    const pushResponse = await fetch(updateUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text().catch(() => 'Unknown error')
      console.error(`[SYNC] Push failed: ${pushResponse.status} - ${errorText}`)
      
      // Update product sync status
      await supabase
        .from('shoprenter_products')
        .update({
          sync_status: 'error',
          sync_error: `Push failed: ${pushResponse.status} - ${errorText.substring(0, 200)}`,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', id)

      return NextResponse.json({ 
        success: false, 
        error: `ShopRenter API hiba (${pushResponse.status}): ${errorText.substring(0, 200)}` 
      }, { status: pushResponse.status })
    }

    const pushResult = await pushResponse.json().catch(() => null)
    
    // Extract description ID from response if we created it
    let finalDescriptionId = descriptionId
    if (!finalDescriptionId && pushResult?.id) {
      finalDescriptionId = pushResult.id
    } else if (!finalDescriptionId && pushResult?.href) {
      const parts = pushResult.href.split('/')
      finalDescriptionId = parts[parts.length - 1]
    }

    // Update local database with ShopRenter description ID if we got it
    if (finalDescriptionId && !huDescription.shoprenter_id) {
      await supabase
        .from('shoprenter_product_descriptions')
        .update({ shoprenter_id: finalDescriptionId })
        .eq('id', huDescription.id)
    }

    // Sync product tags (productTags)
    try {
      const productTags = product.product_tags || []
      const huTags = productTags.find((t: any) => t.language_code === 'hu')
      
      // Always sync tags - if empty, delete in ShopRenter
      if (huTags) {
        const tagsValue = huTags.tags ? huTags.tags.trim() : ''
        
        // If tags are empty, delete in ShopRenter
        if (tagsValue.length === 0) {
          // Try to find and delete existing tag in ShopRenter
          let productTagId = huTags.shoprenter_id
          
          if (!productTagId) {
            try {
              const tagSearchUrl = `${apiBaseUrl}/productTags?productId=${encodeURIComponent(product.shoprenter_id)}&languageId=${languageId}&full=1`
              const tagSearchResponse = await fetch(tagSearchUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })
              
              if (tagSearchResponse.ok) {
                const tagSearchData = await tagSearchResponse.json().catch(() => null)
                if (tagSearchData?.response?.items && tagSearchData.response.items.length > 0) {
                  const matchingTag = tagSearchData.response.items.find((item: any) => {
                    const itemLangId = item.language?.innerId || item.language?.id
                    return itemLangId === languageId || itemLangId === '1' || itemLangId === 1
                  })
                  if (matchingTag) {
                    productTagId = matchingTag.id || matchingTag.href?.split('/').pop()
                  }
                }
              }
            } catch (tagSearchError) {
              console.warn('[SYNC] Failed to search for existing productTag for deletion:', tagSearchError)
            }
          }

          if (productTagId) {
            // Delete tag in ShopRenter
            try {
              const deleteResponse = await fetch(`${apiBaseUrl}/productTags/${productTagId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })

              if (deleteResponse.ok || deleteResponse.status === 204) {
                console.log(`[SYNC] Successfully deleted product tags in ShopRenter`)
              } else {
                const errorText = await deleteResponse.text().catch(() => 'Unknown error')
                console.warn(`[SYNC] Failed to delete product tags in ShopRenter: ${deleteResponse.status} - ${errorText}`)
              }
            } catch (deleteError) {
              console.warn(`[SYNC] Error deleting product tags in ShopRenter:`, deleteError)
            }
          } else {
            console.log(`[SYNC] No product tags to delete in ShopRenter (not found)`)
          }
        } else {
          // Tags are not empty - update or create
          // Get or create productTag in ShopRenter
          // First, try to get existing productTag ID
          let productTagId = huTags.shoprenter_id
          
          // If we don't have a ShopRenter ID, try to find it
          if (!productTagId) {
            try {
              const tagSearchUrl = `${apiBaseUrl}/productTags?productId=${encodeURIComponent(product.shoprenter_id)}&languageId=${languageId}&full=1`
              const tagSearchResponse = await fetch(tagSearchUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })
              
              if (tagSearchResponse.ok) {
                const tagSearchData = await tagSearchResponse.json().catch(() => null)
                if (tagSearchData?.response?.items && tagSearchData.response.items.length > 0) {
                  // Find tag with matching language
                  const matchingTag = tagSearchData.response.items.find((item: any) => {
                    const itemLangId = item.language?.innerId || item.language?.id
                    return itemLangId === languageId || itemLangId === '1' || itemLangId === 1
                  })
                  if (matchingTag) {
                    productTagId = matchingTag.id || matchingTag.href?.split('/').pop()
                  }
                }
              }
            } catch (tagSearchError) {
              console.warn('[SYNC] Failed to search for existing productTag:', tagSearchError)
            }
          }

          // Prepare productTag payload
          const tagPayload: any = {
            tags: tagsValue,
            product: {
              id: product.shoprenter_id
            },
            language: {
              id: languageId
            }
          }

        // Determine endpoint - use PUT if we have tag ID, POST if not
        let tagUpdateUrl: string
        let tagMethod: string

        if (productTagId) {
          // Update existing tag
          tagUpdateUrl = `${apiBaseUrl}/productTags/${productTagId}`
          tagMethod = 'PUT'
        } else {
          // Create new tag
          tagUpdateUrl = `${apiBaseUrl}/productTags`
          tagMethod = 'POST'
        }

        console.log(`[SYNC] ${tagMethod} ${tagUpdateUrl} for product tags`)

        // Push tags to ShopRenter
        const tagPushResponse = await fetch(tagUpdateUrl, {
          method: tagMethod,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(tagPayload),
          signal: AbortSignal.timeout(10000)
        })

        if (tagPushResponse.ok) {
          const tagPushResult = await tagPushResponse.json().catch(() => null)
          
          // Extract tag ID from response if we created it
          let finalTagId = productTagId
          if (!finalTagId && tagPushResult?.id) {
            finalTagId = tagPushResult.id
          } else if (!finalTagId && tagPushResult?.href) {
            const parts = tagPushResult.href.split('/')
            finalTagId = parts[parts.length - 1]
          }

          // Update local database with ShopRenter tag ID if we got it
          if (finalTagId && !huTags.shoprenter_id) {
            await supabase
              .from('product_tags')
              .update({ shoprenter_id: finalTagId })
              .eq('id', huTags.id)
          }

          console.log(`[SYNC] Successfully synced product tags: "${tagsValue}"`)
        } else {
          const errorText = await tagPushResponse.text().catch(() => 'Unknown error')
          console.warn(`[SYNC] Failed to sync product tags: ${tagPushResponse.status} - ${errorText}`)
          // Don't fail the entire sync if tag sync fails
        }
        }
      } else {
        // No tags entry in database - check if we need to delete in ShopRenter
        // (This handles the case where tags were deleted in ERP but ShopRenter still has them)
        try {
          const tagSearchUrl = `${apiBaseUrl}/productTags?productId=${encodeURIComponent(product.shoprenter_id)}&languageId=${languageId}&full=1`
          const tagSearchResponse = await fetch(tagSearchUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          })
          
          if (tagSearchResponse.ok) {
            const tagSearchData = await tagSearchResponse.json().catch(() => null)
            if (tagSearchData?.response?.items && tagSearchData.response.items.length > 0) {
              // Find and delete tag with matching language
              const matchingTag = tagSearchData.response.items.find((item: any) => {
                const itemLangId = item.language?.innerId || item.language?.id
                return itemLangId === languageId || itemLangId === '1' || itemLangId === 1
              })
              
              if (matchingTag) {
                const productTagId = matchingTag.id || matchingTag.href?.split('/').pop()
                if (productTagId) {
                  const deleteResponse = await fetch(`${apiBaseUrl}/productTags/${productTagId}`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(10000)
                  })

                  if (deleteResponse.ok || deleteResponse.status === 204) {
                    console.log(`[SYNC] Deleted product tags in ShopRenter (no tags in ERP)`)
                  }
                }
              }
            }
          }
        } catch (deleteError) {
          console.warn(`[SYNC] Error checking/deleting product tags in ShopRenter:`, deleteError)
        }
      }
    } catch (tagSyncError: any) {
      // Don't fail the entire sync if tag sync fails
      console.warn(`[SYNC] Error syncing product tags:`, tagSyncError?.message || tagSyncError)
    }

    // Now pull back from ShopRenter to verify
    const pullUrl = useOAuth 
      ? `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
      : `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
    
    const pullResponse = await fetch(pullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(30000)
    })

    if (pullResponse.ok) {
      const pullData = await pullResponse.json().catch(() => null)
      
      if (pullData) {
        // Update local database with pulled data (sync from ShopRenter)
        // This ensures local DB matches what's in ShopRenter
        const syncResponse = await fetch(`${request.nextUrl.origin}/api/connections/${connection.id}/sync-products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_id: product.shoprenter_id
          })
        })

        // Don't fail if pull sync fails, we already pushed successfully
        if (!syncResponse.ok) {
          console.warn('[SYNC] Pull verification failed, but push was successful')
        }
      }
    }

    // Update product sync status
    await supabase
      .from('shoprenter_products')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', id)

    return NextResponse.json({ 
      success: true,
      message: 'Termék sikeresen szinkronizálva a webshopba'
    })
  } catch (error) {
    console.error('Error syncing product:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
