// ShopRenter Image Service
// Handles fetching and syncing product images via ShopRenter API

import { extractShopNameFromUrl, getShopRenterAuthHeader } from './shoprenter-api'
import { getShopRenterRateLimiter } from './shoprenter-rate-limiter'

export interface ShopRenterImage {
  id: string // ShopRenter productImage ID
  imagePath: string
  imageAlt: string | null
  sortOrder: number
  product: {
    id: string
    href: string
  }
}

export interface ShopRenterImageServiceConfig {
  apiUrl: string
  username: string
  password: string
  shopName: string
}

/**
 * Fetch all product images from ShopRenter for a given product
 */
export async function fetchProductImages(
  config: ShopRenterImageServiceConfig,
  productShopRenterId: string
): Promise<ShopRenterImage[]> {
  const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
    config.shopName,
    config.username,
    config.password,
    config.apiUrl
  )

  // Get rate limiter to respect ShopRenter's 3 req/sec limit
  const rateLimiter = getShopRenterRateLimiter()

  try {
    // Fetch product images using productId filter with rate limiting
    const response = await rateLimiter.execute(() =>
      fetch(
        `${apiBaseUrl}/productImages?productId=${encodeURIComponent(productShopRenterId)}&full=1&limit=200`,
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

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to fetch product images: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.response || !data.response.items) {
      return []
    }

    // Parse images from response
    // When full=1, items might be full objects or just hrefs - need to fetch individually if needed
    const images: ShopRenterImage[] = []
    
    for (const item of data.response.items) {
      // If item is just an href (no imagePath), fetch the full object with rate limiting
      if (item.href && !item.imagePath) {
        try {
          // Extract the ID from href and fetch with full=1
          const itemId = item.href.split('/').pop()
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
              if (itemData.imagePath) {
                images.push({
                  id: itemData.id || itemId,
                  imagePath: itemData.imagePath || '',
                  imageAlt: itemData.imageAlt || null,
                  sortOrder: parseInt(itemData.sortOrder || '0', 10),
                  product: {
                    id: productShopRenterId,
                    href: itemData.product?.href || ''
                  }
                })
              }
            }
          }
        } catch (fetchError) {
          console.warn(`[SHOPRENTER IMAGE] Failed to fetch full image data for ${item.href}:`, fetchError)
        }
      } else if (item.imagePath) {
        // Item is already a full object with imagePath
        images.push({
          id: item.id || item.href?.split('/').pop() || '',
          imagePath: item.imagePath || '',
          imageAlt: item.imageAlt || null,
          sortOrder: parseInt(item.sortOrder || '0', 10),
          product: {
            id: productShopRenterId,
            href: item.product?.href || ''
          }
        })
      }
    }

    // Sort by sortOrder
    images.sort((a, b) => a.sortOrder - b.sortOrder)

    return images
  } catch (error: any) {
    console.error('[SHOPRENTER IMAGE] Fetch error:', error)
    throw new Error(`Failed to fetch product images: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Sync alt text to ShopRenter for a specific image
 */
export async function syncImageAltText(
  config: ShopRenterImageServiceConfig,
  imageShopRenterId: string,
  altText: string
): Promise<{ success: boolean; error?: string }> {
  const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
    config.shopName,
    config.username,
    config.password,
    config.apiUrl
  )

  // Get rate limiter to respect ShopRenter's 3 req/sec limit
  const rateLimiter = getShopRenterRateLimiter()

  try {
    // First, get the current image data to preserve other fields with rate limiting
    const getResponse = await rateLimiter.execute(() =>
      fetch(
        `${apiBaseUrl}/productImages/${encodeURIComponent(imageShopRenterId)}?full=1`,
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

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error')
      // Return specific error for 404 so caller can handle it (e.g., try to find/create image)
      if (getResponse.status === 404) {
        throw new Error(`IMAGE_NOT_FOUND: Image ${imageShopRenterId} not found in ShopRenter. ${errorText}`)
      }
      throw new Error(`Failed to fetch image data: ${getResponse.status} - ${errorText}`)
    }

    const imageData = await getResponse.json()
    
    // Update with new alt text
    const updatePayload: any = {
      imagePath: imageData.imagePath,
      imageAlt: altText,
      sortOrder: imageData.sortOrder || 0,
      product: {
        id: imageData.product?.id || imageData.product?.href?.split('/').pop() || ''
      }
    }

    // PUT request to update the image with rate limiting
    const putResponse = await rateLimiter.execute(() =>
      fetch(
        `${apiBaseUrl}/productImages/${encodeURIComponent(imageShopRenterId)}`,
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
    )

    if (!putResponse.ok) {
      const errorText = await putResponse.text().catch(() => 'Unknown error')
      throw new Error(`Failed to sync alt text: ${putResponse.status} - ${errorText}`)
    }

    return { success: true }
  } catch (error: any) {
    console.error('[SHOPRENTER IMAGE] Sync error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error'
    }
  }
}

/**
 * Extract images from productExtend allImages response
 */
export function extractImagesFromProductExtend(
  product: any,
  productShopRenterId: string
): Array<{
  imagePath: string
  imageUrl: string | null
  isMain: boolean
  sortOrder: number
}> {
  const images: Array<{
    imagePath: string
    imageUrl: string | null
    isMain: boolean
    sortOrder: number
  }> = []

  // Extract main image
  if (product.mainPicture) {
    images.push({
      imagePath: product.mainPicture,
      imageUrl: product.allImages?.mainImage || null,
      isMain: true,
      sortOrder: 0
    })
  }

  // Extract additional images from allImages
  if (product.allImages) {
    let additionalIndex = 1
    Object.keys(product.allImages).forEach((key) => {
      if (key !== 'mainImage' && product.allImages[key]) {
        // Extract image path from URL or use key
        const imageUrl = product.allImages[key]
        let imagePath = ''
        
        // Try to extract path from URL
        if (typeof imageUrl === 'string') {
          const match = imageUrl.match(/product\/([^?]+)/)
          if (match) {
            imagePath = `product/${match[1]}`
          } else {
            // Fallback: use key as identifier
            imagePath = `product/${key}.jpg`
          }
        }

        if (imagePath) {
          images.push({
            imagePath,
            imageUrl,
            isMain: false,
            sortOrder: additionalIndex
          })
          additionalIndex++
        }
      }
    })
  }

  return images
}
