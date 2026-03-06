import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { syncImageAltText, fetchProductImages } from '@/lib/shoprenter-image-service'
import { extractShopNameFromUrl, getShopRenterAuthHeader } from '@/lib/shoprenter-api'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'

/**
 * POST /api/products/[id]/images/[imageId]/sync-alt-text
 * Sync alt text to ShopRenter for a specific image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id: productId, imageId } = await params
  
  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get product with connection
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*)
      `)
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = product.webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get image
    const { data: image, error: imageError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', productId)
      .single()

    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    if (!image.alt_text) {
      return NextResponse.json({ error: 'No alt text to sync' }, { status: 400 })
    }

    // Handle main image separately - it uses productExtend.imageAlt, not productImages
    if (image.is_main_image) {
      const shopName = extractShopNameFromUrl(connection.api_url)
      if (!shopName) {
        return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
      }

      const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
        shopName,
        connection.username,
        connection.password,
        connection.api_url
      )

      try {
        // Get current product data
        // Note: ShopRenter IDs are base64 and should be used directly in URLs (not encoded)
        const getResponse = await fetch(
          `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(30000)
          }
        )

        if (!getResponse.ok) {
          const errorText = await getResponse.text().catch(() => 'Unknown error')
          throw new Error(`Failed to fetch product data: ${getResponse.status} - ${errorText}`)
        }

        const productData = await getResponse.json()

        // Build minimal PUT payload - only include essential fields for updating imageAlt
        // Based on ShopRenter API docs, we need to include basic product fields
        const updatePayload: any = {
          sku: productData.sku,
          price: productData.price,
          stock1: productData.stock1 || '0',
          stock2: productData.stock2 || '0',
          stock3: productData.stock3 || '0',
          stock4: productData.stock4 || '0',
          status: productData.status || '1',
          mainPicture: productData.mainPicture || '',
          imageAlt: image.alt_text // This is what we're updating
        }

        // Include optional fields if they exist
        if (productData.modelNumber) updatePayload.modelNumber = productData.modelNumber
        if (productData.multiplier !== undefined) updatePayload.multiplier = productData.multiplier
        if (productData.multiplierLock !== undefined) updatePayload.multiplierLock = productData.multiplierLock

        const putResponse = await fetch(
          `${apiBaseUrl}/productExtend/${product.shoprenter_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(updatePayload),
            signal: AbortSignal.timeout(30000)
          }
        )

        if (!putResponse.ok) {
          const errorText = await putResponse.text().catch(() => 'Unknown error')
          throw new Error(`Failed to sync main image alt text: ${putResponse.status} - ${errorText}`)
        }

        // Update status to synced
        await supabase
          .from('product_images')
          .update({
            alt_text_status: 'synced',
            alt_text_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', imageId)

        console.log(`[SYNC ALT TEXT] Successfully synced main image alt text to productExtend`)

        return NextResponse.json({
          success: true,
          message: 'Main image alt text synced successfully'
        })
      } catch (error: any) {
        console.error('[SYNC ALT TEXT] Failed to sync main image alt text:', error)
        await supabase
          .from('product_images')
          .update({
            alt_text_status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', imageId)

        return NextResponse.json({
          success: false,
          error: error?.message || 'Failed to sync main image alt text'
        }, { status: 500 })
      }
    }

    // For non-main images, use productImages API
    // If we don't have ShopRenter image ID, fetch it first
    let shoprenterImageId = image.shoprenter_image_id
    
    if (!shoprenterImageId) {
      const shopName = extractShopNameFromUrl(connection.api_url)
      if (!shopName) {
        return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
      }

      const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
        shopName,
        connection.username,
        connection.password,
        connection.api_url
      )

      const rateLimiter = getShopRenterRateLimiter()

      // Enhanced path normalization (handles both data/ and non-data/ prefixes)
      const normalizePath = (path: string) => {
        if (!path) return ''
        // Remove leading "data/" if present, normalize slashes, lowercase, trim
        return path
          .replace(/^data\//, '')
          .replace(/\\/g, '/')
          .toLowerCase()
          .trim()
      }

      const getFilename = (path: string) => {
        if (!path) return ''
        const normalized = normalizePath(path)
        const parts = normalized.split('/')
        return parts[parts.length - 1] || normalized
      }

      const normalizedImagePath = normalizePath(image.image_path)
      const imageFilename = getFilename(image.image_path)
      
      // Prepare multiple search path variations (ShopRenter might store paths with different formats)
      const originalPathNoData = image.image_path.replace(/^data\//, '')
      const searchPaths = [
        image.image_path, // Original path (preserves case, may have data/)
        normalizedImagePath, // Normalized (lowercase, no data/)
        originalPathNoData, // Original without data/ prefix (preserves case)
        `data/${normalizedImagePath}`, // Normalized with data/ prefix
        `data/${originalPathNoData}`, // Original with data/ prefix (preserves case)
      ].filter((path, index, self) => self.indexOf(path) === index && path) // Remove duplicates and empty strings

      // Strategy 1: Try direct search by imagePath (ShopRenter API supports this)
      // Try multiple path variations since ShopRenter might store paths differently
      let searchSuccess = false
      for (const searchPath of searchPaths) {
        if (searchSuccess) break
        
        try {
          const searchResponse = await rateLimiter.execute(() =>
            fetch(
              `${apiBaseUrl}/productImages?productId=${encodeURIComponent(product.shoprenter_id)}&imagePath=${encodeURIComponent(searchPath)}&full=1&limit=10`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(30000)
              }
            )
          )

          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            if (searchData.response?.items && searchData.response.items.length > 0) {
              // Found by direct search - get the first match
              const foundItem = searchData.response.items[0]
              
              // If item is just an href, fetch the full object
              if (foundItem.href && !foundItem.imagePath) {
                const itemId = foundItem.href.split('/').pop()
                if (itemId) {
                  const itemResponse = await rateLimiter.execute(() =>
                    fetch(
                      `${apiBaseUrl}/productImages/${encodeURIComponent(itemId)}?full=1`,
                      {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                          'Authorization': authHeader
                        },
                        signal: AbortSignal.timeout(10000)
                      }
                    )
                  )
                  
                  if (itemResponse.ok) {
                    const itemData = await itemResponse.json()
                    shoprenterImageId = itemData.id || itemId
                  }
                }
              } else {
                shoprenterImageId = foundItem.id || foundItem.href?.split('/').pop()
              }

              if (shoprenterImageId) {
                await supabase
                  .from('product_images')
                  .update({ shoprenter_image_id: shoprenterImageId })
                  .eq('id', imageId)
                
                console.log(`[SYNC ALT TEXT] Found image via direct search (path: ${searchPath}): ${shoprenterImageId} for path: ${image.image_path}`)
                searchSuccess = true
                break
              }
            }
          }
        } catch (searchError: any) {
          // Continue to next path variation
          console.log(`[SYNC ALT TEXT] Search failed for path "${searchPath}":`, searchError?.message)
        }
      }
      
      if (!searchSuccess) {
        console.warn(`[SYNC ALT TEXT] Direct search failed for all path variations, trying fallback`)
      }

      // Strategy 2: Fallback - fetch all images and match by path
      if (!shoprenterImageId) {
        let shoprenterImages: any[] = []
        try {
          shoprenterImages = await fetchProductImages(
            {
              apiUrl: connection.api_url,
              username: connection.username,
              password: connection.password,
              shopName: shopName
            },
            product.shoprenter_id
          )
        } catch (fetchError: any) {
          console.warn(`[SYNC ALT TEXT] Failed to fetch productImages:`, fetchError?.message)
          shoprenterImages = []
        }
        
        // If no images found in productImages API, the image might only exist in allImages
        // In that case, we need to create the productImage record first
        if (shoprenterImages.length === 0) {
          console.log(`[SYNC ALT TEXT] No images in productImages API, image may only exist in allImages. Attempting to create productImage record.`)
          
          // Normalize the path for ShopRenter API
          // ShopRenter expects paths without leading slash, and may be case-sensitive
          const normalizePathForShopRenter = (path: string) => {
            if (!path) return ''
            // Remove leading slash if present, remove data/ prefix, normalize slashes
            return path
              .replace(/^\//, '') // Remove leading slash
              .replace(/^data\//, '') // Remove data/ prefix
              .replace(/\\/g, '/') // Normalize slashes
              .trim()
          }
          
          // Try multiple path variations - ShopRenter might store paths differently
          const originalPath = image.image_path
          const pathVariations = [
            normalizePathForShopRenter(originalPath), // Normalized (no leading slash, no data/)
            originalPath.replace(/^data\//, '').replace(/\\/g, '/'), // Original without data/, normalized slashes
            originalPath.replace(/^\/+/, '').replace(/^data\//, ''), // Remove leading slashes and data/
            originalPath.replace(/\\/g, '/'), // Just normalize slashes
            originalPath // Original as-is
          ].filter((path, index, self) => self.indexOf(path) === index && path) // Remove duplicates and empty strings
          
          const imagePathForCreation = pathVariations[0] // Use first variation as primary
          
          if (!imagePathForCreation) {
            return NextResponse.json({
              success: false,
              error: `Invalid image path: ${image.image_path}. Cannot create productImage record.`
            }, { status: 400 })
          }
          
          console.log(`[SYNC ALT TEXT] Will try to create productImage with path variations:`, pathVariations)
          
          try {
            // First, try to GET the image by path to see if it exists
            // ShopRenter might have the image but not return it in the list
            let existingImageId: string | null = null
            try {
              // Try searching by path
              const searchResponse = await rateLimiter.execute(() =>
                fetch(
                  `${apiBaseUrl}/productImages?productId=${encodeURIComponent(product.shoprenter_id)}&imagePath=${encodeURIComponent(imagePathForCreation)}&full=1&limit=10`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(10000)
                  }
                )
              )
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json()
                if (searchData.response?.items && searchData.response.items.length > 0) {
                  existingImageId = searchData.response.items[0].id || searchData.response.items[0].href?.split('/').pop()
                  console.log(`[SYNC ALT TEXT] Found existing productImage via path search: ${existingImageId}`)
                }
              }
            } catch (searchError) {
              // Non-fatal, continue to create
              console.log(`[SYNC ALT TEXT] Path search failed, will try to create:`, searchError)
            }
            
            // If we found an existing image, use PUT to update it
            if (existingImageId) {
              shoprenterImageId = existingImageId
              
              // Verify it exists
              const verifyResponse = await rateLimiter.execute(() =>
                fetch(
                  `${apiBaseUrl}/productImages/${encodeURIComponent(shoprenterImageId)}?full=1`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(10000)
                  }
                )
              )
              
              if (verifyResponse.ok) {
                // Image exists, update it with PUT
                const putResponse = await rateLimiter.execute(() =>
                  fetch(
                    `${apiBaseUrl}/productImages/${encodeURIComponent(shoprenterImageId)}`,
                    {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      body: JSON.stringify({
                        imagePath: imagePathForCreation,
                        imageAlt: image.alt_text || '',
                        sortOrder: image.sort_order?.toString() || '0',
                        product: {
                          id: product.shoprenter_id
                        }
                      }),
                      signal: AbortSignal.timeout(30000)
                    }
                  )
                )
                
                if (putResponse.ok) {
                  await supabase
                    .from('product_images')
                    .update({ shoprenter_image_id: shoprenterImageId })
                    .eq('id', imageId)
                  
                  // Now sync the alt text
                  const syncResult = await syncImageAltText(
                    {
                      apiUrl: connection.api_url,
                      username: connection.username,
                      password: connection.password,
                      shopName: shopName
                    },
                    shoprenterImageId,
                    image.alt_text || ''
                  )
                  
                  if (syncResult.success) {
                    await supabase
                      .from('product_images')
                      .update({
                        alt_text_status: 'synced',
                        alt_text_synced_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', imageId)
                    
                    return NextResponse.json({
                      success: true,
                      message: 'Found existing productImage and synced alt text successfully'
                    })
                  } else {
                    return NextResponse.json({
                      success: false,
                      error: syncResult.error || 'Failed to sync alt text after updating productImage'
                    }, { status: 500 })
                  }
                } else {
                  const putErrorText = await putResponse.text().catch(() => 'Unknown error')
                  console.error(`[SYNC ALT TEXT] Failed to update productImage: ${putResponse.status} - ${putErrorText}`)
                  // Clear the ID since update failed
                  shoprenterImageId = null
                  // Continue to create logic
                }
              } else {
                // Verification failed, clear the ID
                shoprenterImageId = null
              }
            }
            
            // If we didn't find existing image or update failed, try to create
            if (!shoprenterImageId) {
            const createResponse = await rateLimiter.execute(() =>
              fetch(
                `${apiBaseUrl}/productImages`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify({
                    imagePath: imagePathForCreation,
                    imageAlt: image.alt_text || '',
                      sortOrder: image.sort_order?.toString() || '0',
                    product: {
                      id: product.shoprenter_id
                    }
                  }),
                  signal: AbortSignal.timeout(30000)
                }
              )
            )
            
            if (createResponse.ok) {
              const createdData = await createResponse.json()
              shoprenterImageId = createdData.id || createdData.href?.split('/').pop()
              
              if (shoprenterImageId) {
                  // Verify the created image exists
                  let imageVerified = false
                  let retryCount = 0
                  const maxRetries = 3
                  
                  while (!imageVerified && retryCount < maxRetries) {
                    try {
                      if (retryCount > 0) {
                        await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
                      }
                      
                      const verifyResponse = await rateLimiter.execute(() =>
                        fetch(
                          `${apiBaseUrl}/productImages/${encodeURIComponent(shoprenterImageId)}?full=1`,
                          {
                            method: 'GET',
                            headers: {
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                              'Authorization': authHeader
                            },
                            signal: AbortSignal.timeout(10000)
                          }
                        )
                      )
                      
                      if (verifyResponse.ok) {
                        imageVerified = true
                        console.log(`[SYNC ALT TEXT] Verified created image exists: ${shoprenterImageId}`)
                      } else if (verifyResponse.status === 404 && retryCount < maxRetries - 1) {
                        retryCount++
                        console.log(`[SYNC ALT TEXT] Image ${shoprenterImageId} not found yet, retrying (${retryCount}/${maxRetries})...`)
                        continue
                      } else {
                        const errorText = await verifyResponse.text().catch(() => 'Unknown error')
                        throw new Error(`Created image ${shoprenterImageId} not found: ${verifyResponse.status} - ${errorText}`)
                      }
                    } catch (verifyError: any) {
                      if (retryCount < maxRetries - 1) {
                        retryCount++
                        console.log(`[SYNC ALT TEXT] Verification error, retrying (${retryCount}/${maxRetries}):`, verifyError?.message)
                        continue
                      } else {
                        throw verifyError
                      }
                    }
                  }
                  
                  if (!imageVerified) {
                    await supabase
                      .from('product_images')
                      .update({ shoprenter_image_id: null })
                      .eq('id', imageId)
                    
                    return NextResponse.json({
                      success: false,
                      error: `Image was created but could not be verified after ${maxRetries} attempts. The image file may exist in ShopRenter but cannot be registered in the productImages API.`
                    }, { status: 500 })
                  }
                  
                  // Image verified, update database and sync
                await supabase
                  .from('product_images')
                  .update({ shoprenter_image_id: shoprenterImageId })
                  .eq('id', imageId)
                
                  console.log(`[SYNC ALT TEXT] Created and verified productImage: ${shoprenterImageId}`)
                
                  // Sync alt text
                const syncResult = await syncImageAltText(
                  {
                    apiUrl: connection.api_url,
                    username: connection.username,
                    password: connection.password,
                    shopName: shopName
                  },
                  shoprenterImageId,
                  image.alt_text || ''
                )
                
                if (syncResult.success) {
                  await supabase
                    .from('product_images')
                    .update({
                      alt_text_status: 'synced',
                      alt_text_synced_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', imageId)
                  
                  return NextResponse.json({
                    success: true,
                      message: 'Image record created, verified, and alt text synced successfully'
                  })
                } else {
                  return NextResponse.json({
                    success: false,
                    error: syncResult.error || 'Failed to sync alt text after creating image record'
                  }, { status: 500 })
                }
              }
            } else {
              const errorText = await createResponse.text().catch(() => 'Unknown error')
              
                // Handle 409 - Resource exists
              if (createResponse.status === 409) {
                try {
                  const errorData = JSON.parse(errorText)
                    let extractedId = errorData.id || errorData.href?.split('/').pop()
                    
                    if (extractedId) {
                      console.log(`[SYNC ALT TEXT] Got 409, extracted ID: ${extractedId}, verifying it exists first`)
                      
                      // CRITICAL: Verify the extracted ID actually exists before trying to PUT
                      // ShopRenter might return an ID that doesn't actually exist
                      let idVerified = false
                      try {
                        const verifyGetResponse = await rateLimiter.execute(() =>
                          fetch(
                            `${apiBaseUrl}/productImages/${encodeURIComponent(extractedId)}?full=1`,
                            {
                              method: 'GET',
                              headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': authHeader
                              },
                              signal: AbortSignal.timeout(10000)
                            }
                          )
                        )
                        
                        if (verifyGetResponse.ok) {
                          idVerified = true
                          console.log(`[SYNC ALT TEXT] Verified extracted ID exists: ${extractedId}`)
                        } else {
                          const verifyErrorText = await verifyGetResponse.text().catch(() => 'Unknown error')
                          console.error(`[SYNC ALT TEXT] Extracted ID ${extractedId} does not exist: ${verifyGetResponse.status} - ${verifyErrorText}`)
                          
                          // ID is invalid, try to search by path instead
                          console.log(`[SYNC ALT TEXT] Trying to find image by path search instead`)
                          try {
                            const pathSearchResponse = await rateLimiter.execute(() =>
                              fetch(
                                `${apiBaseUrl}/productImages?productId=${encodeURIComponent(product.shoprenter_id)}&imagePath=${encodeURIComponent(imagePathForCreation)}&full=1&limit=10`,
                                {
                                  method: 'GET',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'Authorization': authHeader
                                  },
                                  signal: AbortSignal.timeout(10000)
                                }
                              )
                            )
                            
                            if (pathSearchResponse.ok) {
                              const pathSearchData = await pathSearchResponse.json()
                              if (pathSearchData.response?.items && pathSearchData.response.items.length > 0) {
                                const foundId = pathSearchData.response.items[0].id || pathSearchData.response.items[0].href?.split('/').pop()
                                if (foundId) {
                                  console.log(`[SYNC ALT TEXT] Found image via path search: ${foundId}`)
                                  extractedId = foundId
                                  idVerified = true
                                }
                              }
                            }
                          } catch (pathSearchError) {
                            console.error(`[SYNC ALT TEXT] Path search failed:`, pathSearchError)
                          }
                        }
                      } catch (verifyError) {
                        console.error(`[SYNC ALT TEXT] Error verifying extracted ID:`, verifyError)
                      }
                      
                      // Only try PUT if ID is verified
                      if (idVerified) {
                        // Try PUT to update the existing record
                        const putResponse = await rateLimiter.execute(() =>
                          fetch(
                            `${apiBaseUrl}/productImages/${encodeURIComponent(extractedId)}`,
                            {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': authHeader
                              },
                              body: JSON.stringify({
                                imagePath: imagePathForCreation,
                                imageAlt: image.alt_text || '',
                                sortOrder: image.sort_order?.toString() || '0',
                                product: {
                                  id: product.shoprenter_id
                                }
                              }),
                              signal: AbortSignal.timeout(30000)
                            }
                          )
                        )
                        
                        if (putResponse.ok) {
                          shoprenterImageId = extractedId
                    await supabase
                      .from('product_images')
                      .update({ shoprenter_image_id: shoprenterImageId })
                      .eq('id', imageId)
                    
                          // Sync alt text
                    const syncResult = await syncImageAltText(
                      {
                        apiUrl: connection.api_url,
                        username: connection.username,
                        password: connection.password,
                        shopName: shopName
                      },
                      shoprenterImageId,
                      image.alt_text || ''
                    )
                    
                    if (syncResult.success) {
                      await supabase
                        .from('product_images')
                        .update({
                          alt_text_status: 'synced',
                          alt_text_synced_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', imageId)
                      
                      return NextResponse.json({
                        success: true,
                              message: 'Updated existing productImage (409) and synced alt text successfully'
                      })
                    } else {
                      return NextResponse.json({
                        success: false,
                              error: syncResult.error || 'Failed to sync alt text after updating productImage'
                      }, { status: 500 })
                          }
                        } else {
                          const putErrorText = await putResponse.text().catch(() => 'Unknown error')
                          console.error(`[SYNC ALT TEXT] PUT failed for verified ID: ${putResponse.status} - ${putErrorText}`)
                          
                          // If PUT also returns 409, it means the resource structure is different
                          // Try to sync alt text directly using the ID
                          if (putResponse.status === 409) {
                            console.log(`[SYNC ALT TEXT] PUT returned 409, trying to sync alt text directly`)
                            const syncResult = await syncImageAltText(
                              {
                                apiUrl: connection.api_url,
                                username: connection.username,
                                password: connection.password,
                                shopName: shopName
                              },
                              extractedId,
                              image.alt_text || ''
                            )
                            
                            if (syncResult.success) {
                              shoprenterImageId = extractedId
                              await supabase
                                .from('product_images')
                                .update({
                                  shoprenter_image_id: shoprenterImageId,
                                  alt_text_status: 'synced',
                                  alt_text_synced_at: new Date().toISOString(),
                                  updated_at: new Date().toISOString()
                                })
                                .eq('id', imageId)
                              
                              return NextResponse.json({
                                success: true,
                                message: 'Synced alt text directly (PUT returned 409, but sync succeeded)'
                              })
                            }
                          }
                          
                          // If we have no images in productImages API and PUT failed, 
                          // don't fall through to matching logic
                          if (shoprenterImages.length === 0) {
                            return NextResponse.json({
                              success: false,
                              error: `Cannot sync alt text: Image exists (409) but PUT update failed. Path: ${imagePathForCreation}. ShopRenter returned: ${putResponse.status} - ${putErrorText}. The resource may exist but cannot be updated via PUT.`
                            }, { status: 500 })
                          }
                          // Continue to matching logic only if we have images to match against
                        }
                      } else {
                        // ID verification failed, extracted ID is invalid
                        console.error(`[SYNC ALT TEXT] Extracted ID ${extractedId} is invalid, cannot use it`)
                        
                        if (shoprenterImages.length === 0) {
                          return NextResponse.json({
                            success: false,
                            error: `Cannot sync alt text: ShopRenter returned 409 but the extracted ID is invalid. Path: ${imagePathForCreation}. The image may exist in ShopRenter but the ID format is incorrect. Please try syncing the product again.`
                          }, { status: 500 })
                        }
                        // Continue to matching logic only if we have images to match against
                    }
                  }
                } catch (parseError) {
                    console.error(`[SYNC ALT TEXT] Failed to parse 409 error:`, parseError)
                }
              }
              
              console.error(`[SYNC ALT TEXT] Failed to create productImage: ${createResponse.status} - ${errorText}`)
                
                // If we have no images in productImages API and creation failed, 
                // don't fall through to matching logic - return a helpful error
                if (shoprenterImages.length === 0) {
                  return NextResponse.json({
                    success: false,
                    error: `Cannot sync alt text: Image exists in allImages but cannot be registered in productImages API. Path: ${imagePathForCreation}. ShopRenter returned: ${createResponse.status}. The image file may not exist in ShopRenter's file system, or the path format is incorrect. Please ensure the product is synced and the image file exists.`
                  }, { status: 404 })
                }
                // Continue to matching logic below only if we have images to match against
              }
            }
          } catch (createError: any) {
            console.error(`[SYNC ALT TEXT] Error creating productImage:`, createError?.message)
            
            // If we have no images in productImages API and creation failed, 
            // don't fall through to matching logic - return a helpful error
            if (shoprenterImages.length === 0) {
              return NextResponse.json({
                success: false,
                error: `Cannot sync alt text: Failed to create productImage record. Error: ${createError?.message || 'Unknown error'}. The image may only exist in allImages and cannot be registered in the productImages API. Please sync the product first.`
              }, { status: 500 })
            }
            // Continue to matching logic below only if we have images to match against
          }
        }

        // Only try matching if we have images to match against
        // If shoprenterImages is still empty after creation attempts, skip matching
        if (shoprenterImages.length === 0 && !shoprenterImageId) {
          return NextResponse.json({
            success: false,
            error: `Cannot sync alt text: Image not found in productImages API and could not be created. Path: ${image.image_path}. The image may only exist in allImages. Please ensure the product is synced and try again.`
          }, { status: 404 })
        }

        const matchingImage = shoprenterImages.find((img: any) => {
          const normalizedShopRenterPath = normalizePath(img.imagePath)
          const shopRenterFilename = getFilename(img.imagePath)
          
          // Also try case-insensitive matching with original paths
          const originalImagePath = image.image_path.replace(/^data\//, '').replace(/\\/g, '/')
          const originalShopRenterPath = img.imagePath.replace(/^data\//, '').replace(/\\/g, '/')
          
          // Multiple matching strategies (in order of reliability):
          // 1. Exact normalized path match (case-insensitive)
          // 2. Exact original path match (case-sensitive)
          // 3. Case-insensitive original path match
          // 4. Filename match (most reliable when paths differ)
          // 5. Path ends match (handles different prefixes)
          // 6. Filename in path (handles subdirectory differences)
          return normalizedImagePath === normalizedShopRenterPath ||
                 originalImagePath === originalShopRenterPath ||
                 originalImagePath.toLowerCase() === originalShopRenterPath.toLowerCase() ||
                 imageFilename === shopRenterFilename ||
                 imageFilename.toLowerCase() === shopRenterFilename.toLowerCase() ||
                 normalizedImagePath.endsWith(normalizedShopRenterPath) ||
                 normalizedShopRenterPath.endsWith(normalizedImagePath) ||
                 normalizedImagePath.includes(shopRenterFilename) ||
                 normalizedShopRenterPath.includes(imageFilename)
        })

        if (matchingImage) {
          shoprenterImageId = matchingImage.id
          
          await supabase
            .from('product_images')
            .update({ shoprenter_image_id: shoprenterImageId })
            .eq('id', imageId)
          
          console.log(`[SYNC ALT TEXT] Found matching ShopRenter image: ${shoprenterImageId} for path: ${image.image_path}`)
        } else {
          // Log detailed diagnostic information
          console.error(`[SYNC ALT TEXT] No matching ShopRenter image found for path: ${image.image_path}`)
          console.error(`[SYNC ALT TEXT] Normalized search path: ${normalizedImagePath}`)
          console.error(`[SYNC ALT TEXT] Search filename: ${imageFilename}`)
          console.error(`[SYNC ALT TEXT] Tried search paths:`, searchPaths)
          console.error(`[SYNC ALT TEXT] Available ShopRenter images (${shoprenterImages.length}):`, shoprenterImages.map(img => ({
            id: img.id,
            path: img.imagePath,
            normalized: normalizePath(img.imagePath),
            filename: getFilename(img.imagePath),
            sortOrder: img.sortOrder
          })))
          
          // Try to find by filename only (most lenient match)
          const filenameMatch = shoprenterImages.find((img: any) => {
            const shopRenterFilename = getFilename(img.imagePath)
            return imageFilename === shopRenterFilename
          })
          
          if (filenameMatch) {
            console.warn(`[SYNC ALT TEXT] Found match by filename only (paths differ): ${filenameMatch.imagePath} vs ${image.image_path}`)
            shoprenterImageId = filenameMatch.id
            
            await supabase
              .from('product_images')
              .update({ shoprenter_image_id: shoprenterImageId })
              .eq('id', imageId)
            
            console.log(`[SYNC ALT TEXT] Using filename match: ${shoprenterImageId}`)
          } else {
            return NextResponse.json({ 
              error: `Image not found in ShopRenter. Searched for: ${image.image_path} (normalized: ${normalizedImagePath}). Tried ${searchPaths.length} path variations. Please sync the product first.` 
            }, { status: 404 })
          }
        }
      }
    }

    // Sync alt text to ShopRenter
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
    }

    console.log(`[SYNC ALT TEXT] Syncing alt text to ShopRenter for image ${shoprenterImageId}: "${image.alt_text}"`)
    
    const syncResult = await syncImageAltText(
      {
        apiUrl: connection.api_url,
        username: connection.username,
        password: connection.password,
        shopName: shopName
      },
      shoprenterImageId,
      image.alt_text
    )

    if (!syncResult.success) {
      // If image not found (404), clear invalid ID and use path-based approach
      if (syncResult.error?.includes('IMAGE_NOT_FOUND')) {
        console.warn(`[SYNC ALT TEXT] Image ID ${shoprenterImageId} not found in ShopRenter (404), clearing invalid ID and using path-based search`)
        
        // Clear the invalid shoprenter_image_id
        await supabase
          .from('product_images')
          .update({ shoprenter_image_id: null })
          .eq('id', imageId)
        
        // Now trigger the path-based search/create logic by setting shoprenterImageId to null
        // and falling through to the path-based logic below
        shoprenterImageId = null
        
        // Re-run the path-based search/create logic (code continues below)
        // We need to extract the shopName and auth setup again
        const shopNameForRetry = extractShopNameFromUrl(connection.api_url)
        if (!shopNameForRetry) {
          return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
        }

        const { authHeader: retryAuthHeader, apiBaseUrl: retryApiBaseUrl } = await getShopRenterAuthHeader(
          shopNameForRetry,
          connection.username,
          connection.password,
          connection.api_url
        )

        const retryRateLimiter = getShopRenterRateLimiter()

        // Use the same path normalization and search logic
        const normalizePath = (path: string) => {
          if (!path) return ''
          return path
            .replace(/^data\//, '')
            .replace(/\\/g, '/')
            .toLowerCase()
            .trim()
        }

        const getFilename = (path: string) => {
          if (!path) return ''
          const normalized = normalizePath(path)
          const parts = normalized.split('/')
          return parts[parts.length - 1] || normalized
        }

        const normalizedImagePath = normalizePath(image.image_path)
        const imageFilename = getFilename(image.image_path)
        const originalPathNoData = image.image_path.replace(/^data\//, '')
        const searchPaths = [
          image.image_path,
          normalizedImagePath,
          originalPathNoData,
          `data/${normalizedImagePath}`,
          `data/${originalPathNoData}`,
        ].filter((path, index, self) => self.indexOf(path) === index && path)

        // Try to find or create the image
        let foundImageId: string | null = null
        
        // Try direct search
        for (const searchPath of searchPaths) {
          try {
            const searchResponse = await retryRateLimiter.execute(() =>
              fetch(
                `${retryApiBaseUrl}/productImages?productId=${encodeURIComponent(product.shoprenter_id)}&imagePath=${encodeURIComponent(searchPath)}&full=1&limit=10`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': retryAuthHeader
                  },
                  signal: AbortSignal.timeout(30000)
                }
              )
            )

            if (searchResponse.ok) {
              const searchData = await searchResponse.json()
              if (searchData.response?.items && searchData.response.items.length > 0) {
                const foundItem = searchData.response.items[0]
                foundImageId = foundItem.id || foundItem.href?.split('/').pop()
                if (foundImageId) break
              }
            }
          } catch (e) {
            // Continue to next path
          }
        }

        // If still not found, try to create it
        if (!foundImageId) {
          try {
            const createResponse = await retryRateLimiter.execute(() =>
              fetch(
                `${retryApiBaseUrl}/productImages`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': retryAuthHeader
                  },
                  body: JSON.stringify({
                    imagePath: originalPathNoData || normalizedImagePath,
                    imageAlt: image.alt_text || '',
                    sortOrder: image.sort_order || 0,
                    product: {
                      id: product.shoprenter_id
                    }
                  }),
                  signal: AbortSignal.timeout(30000)
                }
              )
            )
            
            if (createResponse.ok) {
              const createdData = await createResponse.json()
              foundImageId = createdData.id || createdData.href?.split('/').pop()
            } else if (createResponse.status === 409) {
              // Image exists, extract ID from error
              const errorText = await createResponse.text().catch(() => '{}')
              try {
                const errorData = JSON.parse(errorText)
                if (errorData.id) {
                  foundImageId = errorData.id
                }
              } catch (e) {
                // Ignore parse error
              }
            }
          } catch (e) {
            // Creation failed
          }
        }

        if (foundImageId) {
          // Update database with new ID and sync
          await supabase
            .from('product_images')
            .update({ shoprenter_image_id: foundImageId })
            .eq('id', imageId)
          
          // Now sync with the found/created ID
          const retrySyncResult = await syncImageAltText(
            {
              apiUrl: connection.api_url,
              username: connection.username,
              password: connection.password,
              shopName: shopNameForRetry
            },
            foundImageId,
            image.alt_text
          )

          if (retrySyncResult.success) {
            await supabase
              .from('product_images')
              .update({
                alt_text_status: 'synced',
                alt_text_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', imageId)
            
            return NextResponse.json({
              success: true,
              message: 'Image found/created and alt text synced successfully'
            })
          } else {
            return NextResponse.json({
              success: false,
              error: retrySyncResult.error || 'Failed to sync alt text after finding/creating image'
            }, { status: 500 })
          }
        } else {
          return NextResponse.json({
            success: false,
            error: `Image not found in ShopRenter and could not be created. Searched for: ${image.image_path}`
          }, { status: 404 })
        }
      }
      
      console.error(`[SYNC ALT TEXT] Failed to sync: ${syncResult.error}`)
      // Update status to error
      await supabase
        .from('product_images')
        .update({
          alt_text_status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId)

      return NextResponse.json({
        success: false,
        error: syncResult.error || 'Failed to sync alt text'
      }, { status: 500 })
    }

    console.log(`[SYNC ALT TEXT] Successfully synced alt text to ShopRenter`)

    // Update status to synced
    await supabase
      .from('product_images')
      .update({
        alt_text_status: 'synced',
        alt_text_synced_at: new Date().toISOString(),
        shoprenter_image_id: shoprenterImageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId)

    return NextResponse.json({
      success: true,
      message: 'Alt text synced successfully'
    })
  } catch (error) {
    console.error('Error syncing alt text:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync alt text'
    }, { status: 500 })
  }
}
