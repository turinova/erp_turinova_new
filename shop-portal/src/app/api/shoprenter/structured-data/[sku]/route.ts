import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateProductStructuredData } from '@/lib/structured-data-generator'

/**
 * CORS headers helper
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24 hours
}

/**
 * OPTIONS /api/shoprenter/structured-data/[sku]
 * Handle CORS preflight requests
 */
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

/**
 * GET /api/shoprenter/structured-data/[sku] or /api/shoprenter/structured-data/[sku].jsonld
 * Generate and return JSON-LD structured data for a product
 * This endpoint is public (no auth required) as it's called from ShopRenter frontend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params
    
    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    // Decode SKU if URL encoded and remove .jsonld extension if present
    let decodedSku = decodeURIComponent(sku)
    
    // Remove .jsonld extension if it's part of the SKU parameter
    if (decodedSku.endsWith('.jsonld')) {
      decodedSku = decodedSku.slice(0, -7) // Remove '.jsonld'
    }

    console.log('[STRUCTURED DATA] Looking for product with SKU:', decodedSku)

    // Create Supabase client (using anon key for public access)
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    // Debug: Log environment variables (without exposing full keys)
    console.log('[STRUCTURED DATA] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      supabaseUrlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
      hasAnonKey: !!supabaseAnonKey,
      anonKeyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'MISSING'
    })
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[STRUCTURED DATA] Missing Supabase environment variables!')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          message: 'Supabase environment variables are not configured',
          sku: decodedSku
        },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // First, try to find the product (maybe use maybeSingle to avoid errors)
    console.log('[STRUCTURED DATA] Querying database for SKU:', decodedSku)
    
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        sku,
        name,
        model_number,
        gtin,
        brand,
        price,
        status,
        product_url,
        product_attributes,
        parent_product_id,
        deleted_at,
        connection_id
      `)
      .eq('sku', decodedSku)
      .maybeSingle() // Use maybeSingle instead of single to avoid errors if not found

    console.log('[STRUCTURED DATA] Query result:', {
      hasProduct: !!product,
      hasError: !!productError,
      productId: product?.id,
      productSku: product?.sku,
      errorCode: productError?.code,
      errorMessage: productError?.message
    })

    if (productError) {
      console.error('[STRUCTURED DATA] Database error:', {
        sku: decodedSku,
        error: productError,
        code: productError.code,
        message: productError.message,
        details: productError.details,
        hint: productError.hint
      })
      
      return NextResponse.json(
        { 
          error: 'Database error',
          sku: decodedSku,
          message: productError.message,
          code: productError.code
        },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }

    if (!product) {
      // Try to see if there are any products with similar SKUs (for debugging)
      const { data: similarProducts } = await supabase
        .from('shoprenter_products')
        .select('sku, name, deleted_at')
        .ilike('sku', `%${decodedSku}%`)
        .limit(5)
      
      console.error('[STRUCTURED DATA] Product not found. Similar SKUs:', similarProducts)
      
      return NextResponse.json(
        { 
          error: 'Product not found',
          sku: decodedSku,
          message: 'No product found with this SKU in the database',
          similarSkus: similarProducts?.map(p => p.sku) || []
        },
        { 
          status: 404,
          headers: corsHeaders
        }
      )
    }

    // Check if product is deleted
    if (product.deleted_at) {
      console.error('[STRUCTURED DATA] Product is deleted:', decodedSku, product.deleted_at)
      return NextResponse.json(
        { 
          error: 'Product not found',
          sku: decodedSku,
          message: 'Product has been deleted',
          deletedAt: product.deleted_at
        },
        { 
          status: 404,
          headers: corsHeaders
        }
      )
    }

    console.log('[STRUCTURED DATA] ✅ Found product:', {
      id: product.id,
      sku: product.sku,
      name: product.name,
      connectionId: product.connection_id
    })

    // Fetch description (Hungarian) - include name field
    const { data: description } = await supabase
      .from('shoprenter_product_descriptions')
      .select('name, description, meta_title, meta_description')
      .eq('product_id', product.id)
      .eq('language_code', 'hu')
      .maybeSingle()
    
    // Log description info for debugging
    if (description) {
      console.log('[STRUCTURED DATA API] Description length from DB:', description.description?.length || 0)
      console.log('[STRUCTURED DATA API] Description contains FAQ:', 
        description.description?.includes('Gyakran ismételt kérdések') || 
        description.description?.includes('GYIK') || 
        false
      )
      if (description.description) {
        const last200 = description.description.substring(Math.max(0, description.description.length - 200))
        console.log('[STRUCTURED DATA API] Description ends with:', last200)
      }
    } else {
      console.log('[STRUCTURED DATA API] No description found in database')
    }

    // Fetch images (use image_url if available, fallback to constructing from image_path)
    const { data: images } = await supabase
      .from('product_images')
      .select('image_url, image_path, alt_text')
      .eq('product_id', product.id)
      .order('is_main_image', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(10)

    // Fetch parent product if this is a child
    // Note: If parent_product_id points to itself, treat as parent (not child)
    let parent = null
    const isSelfReferencing = product.parent_product_id === product.id
    const isChild = product.parent_product_id && !isSelfReferencing
    
    if (isChild) {
      // Fetch parent with attributes needed for productGroupID generation
      const { data: parentData } = await supabase
        .from('shoprenter_products')
        .select('id, sku, name, product_attributes')
        .eq('id', product.parent_product_id)
        .is('deleted_at', null)
        .single()
      
      if (parentData) {
        parent = parentData
      }
    }

    // Fetch children if this is a parent (no parent_product_id OR self-referencing)
    // IMPORTANT: Exclude the parent product itself from children list
    let children: any[] = []
    if (!product.parent_product_id || isSelfReferencing) {
      const { data: childrenData } = await supabase
        .from('shoprenter_products')
        .select('id, sku, name, model_number, gtin, price, status, product_url, product_attributes')
        .eq('parent_product_id', product.id)
        .neq('id', product.id) // Exclude parent from children
        .is('deleted_at', null)
        .limit(50) // Limit variants
      
      if (childrenData && childrenData.length > 0) {
        const childrenIds = childrenData.map(c => c.id)
        
        // Fetch descriptions for all children to get proper names
        const { data: childrenDescriptions } = await supabase
          .from('shoprenter_product_descriptions')
          .select('product_id, name')
          .in('product_id', childrenIds)
          .eq('language_code', 'hu')
        
        // Fetch images for all children (for structured data)
        const { data: childrenImages } = await supabase
          .from('product_images')
          .select('product_id, image_url, image_path')
          .in('product_id', childrenIds)
          .order('is_main_image', { ascending: false })
          .order('sort_order', { ascending: true })
        
        // Map descriptions to children
        const descriptionMap = new Map(
          (childrenDescriptions || []).map((d: any) => [d.product_id, d.name])
        )
        
        // Map images to children (group by product_id)
        const imageMap = new Map<string, string[]>()
        if (childrenImages) {
          childrenImages.forEach((img: any) => {
            const imageUrl = img.image_url || img.image_path
            if (imageUrl) {
              if (!imageMap.has(img.product_id)) {
                imageMap.set(img.product_id, [])
              }
              imageMap.get(img.product_id)!.push(imageUrl)
            }
          })
        }
        
        // Use description name if product.name is null, and add images
        children = childrenData.map((child: any) => ({
          ...child,
          name: child.name || descriptionMap.get(child.id) || child.sku,
          images: imageMap.get(child.id) || null
        }))
      }
    }

    // Get connection to fetch shop URL
    const { data: connection } = await supabase
      .from('shoprenter_connections')
      .select('api_url, shop_name')
      .eq('id', product.connection_id)
      .single()

    // Extract shop URL for constructing absolute image URLs
    const shopUrl = connection?.api_url ? extractShopUrl(connection.api_url) : ''

    // Update children images to be absolute URLs
    if (children.length > 0 && shopUrl) {
      children = children.map((child: any) => {
        if (child.images && Array.isArray(child.images)) {
          child.images = child.images.map((imgUrl: string) => {
            if (!imgUrl) return imgUrl
            // If already absolute, return as is
            if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
              return imgUrl
            }
            // Construct absolute URL from image_path
            const cleanPath = imgUrl.replace(/^data\//, '').replace(/^\//, '')
            return `${shopUrl}/${cleanPath}`
          }).filter((url: string) => url)
        }
        return child
      })
    }

    // Generate structured data
    // Use description.name as fallback if product.name is null
    const structuredData = generateProductStructuredData(
      {
        ...product,
        name: product.name || description?.name || product.sku, // Use description name as fallback
        description: description || null,
        images: images?.map(img => {
          // Use image_url if available, otherwise construct from image_path
          let imageUrl = img.image_url
          if (!imageUrl && img.image_path) {
            // Construct full URL from image_path (using shopUrl already extracted)
            if (shopUrl) {
              // Remove 'data/' prefix if present and construct full URL
              const cleanPath = img.image_path.replace(/^data\//, '').replace(/^\//, '')
              imageUrl = `${shopUrl}/${cleanPath}`
            }
          }
          return {
            url: imageUrl || img.image_path || '',
            alt_text: img.alt_text
          }
        }).filter(img => img.url) || null, // Filter out images without URLs
        parent: parent || null,
        children: children.length > 0 ? children : null
      },
      {
        currency: 'HUF', // Default to HUF, could be fetched from connection
        shopUrl: shopUrl, // Use already extracted shopUrl
        shopName: connection?.shop_name || '',
        vatRate: 27 // Default 27% VAT for Hungary (matches website display)
      }
    )

    // Handle both single schema and array of schemas (Product + FAQPage)
    // Return as JSON-LD with proper headers and UTF-8 encoding
    return NextResponse.json(structuredData, {
      headers: {
        'Content-Type': 'application/ld+json; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        ...corsHeaders
      }
    })
  } catch (error) {
    console.error('[STRUCTURED DATA] Error generating structured data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: corsHeaders
      }
    )
  }
}

/**
 * Extract shop URL from ShopRenter API URL
 */
function extractShopUrl(apiUrl: string): string {
  try {
    // ShopRenter API URLs are like: https://shopname.api.myshoprenter.hu
    // Shop URL is: https://shopname.myshoprenter.hu
    const match = apiUrl.match(/https?:\/\/([^.]+)\.api\.myshoprenter\.hu/)
    if (match && match[1]) {
      return `https://${match[1]}.myshoprenter.hu`
    }
    return ''
  } catch {
    return ''
  }
}
