import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateImageAltText } from '@/lib/image-alt-text-service'
import { checkAvailableCredits } from '@/lib/credit-checker'
import { calculateCreditsForAI } from '@/lib/credit-calculator'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

/**
 * POST /api/products/[id]/images/[imageId]/generate-alt-text
 * Generate alt text for a specific image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id: productId, imageId } = await params
  
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
    // Check credits before generation (image alt text = 1 credit)
    const creditsNeeded = calculateCreditsForAI('image_alt_text')
    const creditCheck = await checkAvailableCredits(user.id, creditsNeeded)
    if (!creditCheck.hasEnough) {
      return NextResponse.json({
        success: false,
        error: 'Nincs elég Turitoken az alt szöveg generálásához',
        credits: {
          available: creditCheck.available,
          required: creditCheck.required,
          limit: creditCheck.limit,
          used: creditCheck.used
        }
      }, { status: 402 }) // 402 Payment Required
    }
    // Get product with attributes
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
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

    // Check if this is a parent product (has children)
    const { data: children, error: childrenError } = await supabase
      .from('shoprenter_products')
      .select('id, product_attributes')
      .eq('parent_product_id', productId)
      .eq('status', 1) // Only active children
    
    const isParent = !childrenError && children && children.length > 0

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

    // Generate alt text
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

    // Update image in database
    const { error: updateError } = await supabase
      .from('product_images')
      .update({
        alt_text: result.altText,
        alt_text_status: 'generated',
        alt_text_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId)

    if (updateError) {
      console.error('Error updating image alt text:', updateError)
      return NextResponse.json({ error: 'Failed to update image' }, { status: 500 })
    }

    // Track credit usage for image alt text generation
    await trackAIUsage({
      userId: user.id,
      featureType: 'image_alt_text',
      tokensUsed: result.tokensUsed,
      modelUsed: result.modelUsed,
      productId: productId,
      creditsUsed: creditsNeeded,
      creditType: 'ai_generation',
      metadata: {
        imageId,
        imagePath: image.image_path,
        isMainImage: image.is_main_image,
        success: true
      }
    })

    return NextResponse.json({
      success: true,
      altText: result.altText,
      tokensUsed: result.tokensUsed,
      modelUsed: result.modelUsed,
      credits: {
        used: creditsNeeded,
        remaining: creditCheck.available - creditsNeeded
      }
    })
  } catch (error) {
    console.error('Error generating alt text:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate alt text'
    }, { status: 500 })
  }
}
