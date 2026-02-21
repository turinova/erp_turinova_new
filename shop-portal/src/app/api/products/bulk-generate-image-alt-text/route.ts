import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateImageAltText } from '@/lib/image-alt-text-service'

/**
 * POST /api/products/bulk-generate-image-alt-text
 * Generate alt text for multiple products' images
 */
export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json()
    const { productIds, onlyMissing = true } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs required' }, { status: 400 })
    }

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as Array<{ productId: string; error: string }>
    }

    // Process each product
    for (const productId of productIds) {
      try {
        // Get product with attributes
        const { data: product, error: productError } = await supabase
          .from('shoprenter_products')
          .select('*')
          .eq('id', productId)
          .single()

        if (productError || !product) {
          results.failed++
          results.errors.push({ productId, error: 'Product not found' })
          continue
        }

        // Get images for this product
        let query = supabase
          .from('product_images')
          .select('*')
          .eq('product_id', productId)

        if (onlyMissing) {
          query = query.in('alt_text_status', ['pending', null])
        }

        const { data: images, error: imagesError } = await query

        if (imagesError || !images || images.length === 0) {
          continue // No images to process
        }

        // Check if this is a parent product (has children)
        const { data: children } = await supabase
          .from('shoprenter_products')
          .select('id, product_attributes')
          .eq('parent_product_id', productId)
          .eq('status', 1) // Only active children
        
        const isParent = children && children.length > 0

        // Determine variant attributes (attributes that differ across children)
        let variantAttributes: string[] = []
        if (isParent && children && children.length > 1) {
          // Parse all children's attributes
          const childrenAttributes = children
            .map(child => {
              try {
                return typeof child.product_attributes === 'string'
                  ? JSON.parse(child.product_attributes)
                  : child.product_attributes
              } catch {
                return null
              }
            })
            .filter(Boolean)

          if (childrenAttributes.length > 0) {
            // Find attributes that have different values across children
            const attributeNames = new Set<string>()
            childrenAttributes.forEach((attrs: any) => {
              if (Array.isArray(attrs)) {
                attrs.forEach((attr: any) => {
                  if (attr.name) attributeNames.add(attr.name.toLowerCase())
                })
              }
            })

            // Check which attributes vary
            attributeNames.forEach(attrName => {
              const values = new Set<string>()
              childrenAttributes.forEach((attrs: any) => {
                if (Array.isArray(attrs)) {
                  const attr = attrs.find((a: any) => a.name?.toLowerCase() === attrName)
                  if (attr) {
                    if (attr.type === 'LIST' && Array.isArray(attr.value)) {
                      attr.value.forEach((v: any) => {
                        values.add(String(v.value || v))
                      })
                    } else {
                      values.add(String(attr.value))
                    }
                  }
                }
              })
              
              // If attribute has multiple different values across children, it's a variant attribute
              if (values.size > 1) {
                variantAttributes.push(attrName)
              }
            })
          }
        }

        // Parse product attributes
        let productAttributes = null
        if (product.product_attributes) {
          try {
            productAttributes = typeof product.product_attributes === 'string' 
              ? JSON.parse(product.product_attributes)
              : product.product_attributes
          } catch {
            productAttributes = null
          }
        }

        // Generate alt text for each image
        for (const image of images) {
          try {
            results.total++

            const result = await generateImageAltText({
              productName: product.name || product.sku,
              sku: product.sku,
              productAttributes: productAttributes,
              imageType: image.is_main_image ? 'main' : 'additional',
              sortOrder: image.sort_order,
              imagePath: image.image_path,
              isParent: isParent,
              variantAttributes: variantAttributes
            })

            // Update image
            await supabase
              .from('product_images')
              .update({
                alt_text: result.altText,
                alt_text_status: 'generated',
                alt_text_generated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', image.id)

            results.success++
          } catch (error: any) {
            results.failed++
            results.errors.push({
              productId,
              error: `Image ${image.id}: ${error?.message || 'Unknown error'}`
            })
          }
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          productId,
          error: error?.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error in bulk generate alt text:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate alt text'
    }, { status: 500 })
  }
}
