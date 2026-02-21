import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateProductStructuredData } from '@/lib/structured-data-generator'

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
        { status: 400 }
      )
    }

    // Decode SKU if URL encoded and remove .jsonld extension if present
    let decodedSku = decodeURIComponent(sku)
    
    // Remove .jsonld extension if it's part of the SKU parameter
    if (decodedSku.endsWith('.jsonld')) {
      decodedSku = decodedSku.slice(0, -7) // Remove '.jsonld'
    }

    // Create Supabase client (using anon key for public access)
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Fetch product by SKU
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
        parent_product_id
      `)
      .eq('sku', decodedSku)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      console.error('[STRUCTURED DATA] Product not found:', decodedSku, productError)
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Fetch description (Hungarian) - include name field
    const { data: description } = await supabase
      .from('shoprenter_product_descriptions')
      .select('name, description, meta_title, meta_description')
      .eq('product_id', product.id)
      .eq('language_code', 'hu')
      .maybeSingle()

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
      const { data: parentData } = await supabase
        .from('shoprenter_products')
        .select('id, sku, name')
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
        .select('id, sku, name, product_attributes')
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
            // Construct full URL from image_path (assuming ShopRenter CDN)
            const shopUrl = connection?.api_url ? extractShopUrl(connection.api_url) : ''
            if (shopUrl) {
              // Remove 'data/' prefix if present and construct full URL
              const cleanPath = img.image_path.replace(/^data\//, '')
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
        shopUrl: connection?.api_url ? extractShopUrl(connection.api_url) : '',
        shopName: connection?.shop_name || ''
      }
    )

    // Return as JSON-LD with proper headers
    return NextResponse.json(structuredData, {
      headers: {
        'Content-Type': 'application/ld+json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*', // Allow CORS from ShopRenter domains
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  } catch (error) {
    console.error('[STRUCTURED DATA] Error generating structured data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
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
