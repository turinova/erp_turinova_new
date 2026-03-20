import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getAdminSupabase } from '@/lib/tenant-supabase'
import { createClient } from '@supabase/supabase-js'
import { generateProductStructuredData } from '@/lib/structured-data-generator'
import { fetchLiveOffersBySku } from '@/lib/shoprenter-live-offers'

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

    // NOTE: This is a PUBLIC endpoint (no auth required) called from ShopRenter frontend
    // Tenant identification is done via query parameter: ?tenant=tenant-slug
    
    // Get tenant slug from query parameter (from ShopRenter template)
    const tenantSlug = request.nextUrl.searchParams.get('tenant')
    
    let supabase: any = null

    if (tenantSlug) {
      // Look up tenant by slug in Admin DB
      console.log('[STRUCTURED DATA] Looking up tenant by slug:', tenantSlug)
      const adminSupabase = await getAdminSupabase()
      
      const { data: tenant, error: tenantError } = await adminSupabase
        .from('tenants')
        .select('id, name, slug, supabase_url, supabase_anon_key')
        .eq('slug', tenantSlug)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single()

      if (tenantError || !tenant) {
        console.error('[STRUCTURED DATA] Tenant not found:', tenantSlug, tenantError?.message)
        return NextResponse.json(
          { 
            error: 'Tenant not found',
            message: `No active tenant found with slug: ${tenantSlug}`,
            sku: decodedSku
          },
          { 
            status: 404,
            headers: corsHeaders
          }
        )
      }

      // Create Supabase client for this tenant's database
      supabase = createClient(
        tenant.supabase_url,
        tenant.supabase_anon_key,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )

      console.log('[STRUCTURED DATA] Using tenant database:', tenant.name, tenant.slug)
    } else {
      // Fallback: Try to get tenant context from session (for backward compatibility)
      try {
        supabase = await getTenantSupabase()
        console.log('[STRUCTURED DATA] Using tenant context from session (fallback)')
      } catch (error) {
        // If tenant context not available and no tenant param, return error
        console.error('[STRUCTURED DATA] No tenant identification provided')
        return NextResponse.json(
          { 
            error: 'Tenant identification required',
            message: 'Please provide tenant parameter in the request URL: ?tenant=tenant-slug',
            sku: decodedSku
          },
          { 
            status: 400,
            headers: corsHeaders
          }
        )
      }
    }
    
    // If we got here, supabase should be set
    if (!supabase) {
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          message: 'Failed to initialize database connection',
          sku: decodedSku
        },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }

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
      .from('webshop_connections')
      .select('api_url, name, username, password')
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

    const relatedSkus = children.map((child: any) => child.sku).filter(Boolean)
    // Keep strict mode enabled so commerce fields are emitted only from validated live data.
    // This reduces mismatch risk for Google Ads.
    const strictOfferMode = true
    const liveOffersBySku = await fetchLiveOffersBySku({
      tenantKey: tenantSlug || 'session',
      rootSku: product.sku,
      relatedSkus,
      connection: connection
        ? {
            api_url: connection.api_url,
            username: connection.username,
            password: connection.password
          }
        : null
    })

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
        shopName: connection?.name || '',
        vatRate: 27, // Default 27% VAT for Hungary (matches website display)
        stripSensitiveCommercialFields: false,
        strictOfferMode,
        liveOffersBySku
      }
    )

    // Return as JSON-LD with proper headers and UTF-8 encoding
    return NextResponse.json(structuredData, {
      headers: {
        'Content-Type': 'application/ld+json; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        'X-Schema-Offer-Mode': strictOfferMode ? 'strict-live' : 'best-effort',
        'X-Schema-Live-Source': liveOffersBySku ? 'shoprenter-live' : 'erp-fallback',
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
