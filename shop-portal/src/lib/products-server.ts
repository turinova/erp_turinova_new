// Server-side Products Utilities
// For use in server components and API routes

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface ShopRenterProduct {
  id: string
  connection_id: string
  shoprenter_id: string
  shoprenter_inner_id: string | null
  sku: string
  model_number: string | null  // Gyártói cikkszám (Manufacturer part number)
  gtin: string | null  // Vonalkód (Barcode/GTIN)
  name: string | null
  brand: string | null  // Brand/manufacturer name from ShopRenter
  status: number
  // Pricing fields (Árazás)
  price: number | null  // Nettó ár (Net price)
  cost: number | null  // Beszerzési ár (Cost/purchase price)
  multiplier: number | null  // Árazási szorzó (Price multiplier)
  multiplier_lock: boolean  // Szorzó zárolás (Multiplier lock)
  // Competitor tracking
  competitor_tracking_enabled: boolean  // Whether this product is tracked for competitor prices
  // URLs
  product_url: string | null
  url_slug: string | null
  url_alias_id: string | null  // ShopRenter URL alias resource ID
  last_url_synced_at: string | null
  last_synced_at: string | null
  sync_status: string
  sync_error: string | null
  // Product attributes (from ShopRenter productAttributeExtend)
  product_attributes: Array<{
    type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
    name: string // Internal identifier (e.g., "meret", "szin")
    display_name?: string | null // Display name from AttributeDescription (e.g., "Méret", "Szín") - PRIMARY for display
    prefix?: string | null // Text before value
    postfix?: string | null // Text after value
    value: any // Can be array (LIST) or single value (INTEGER/FLOAT/TEXT)
  }> | null
  // Parent-child relationship
  parent_product_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ShopRenterProductDescription {
  id: string
  product_id: string
  language_code: string
  name: string
  meta_title: string | null
  meta_keywords: string | null
  meta_description: string | null
  short_description: string | null
  description: string | null
  parameters: string | null // Product parameters (language-specific)
  generation_instructions: string | null
  shoprenter_id: string | null
  created_at: string
  updated_at: string
}

export interface ProductWithDescriptions extends ShopRenterProduct {
  descriptions: ShopRenterProductDescription[]
}

export interface ProductsPaginationResult {
  products: ShopRenterProduct[]
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
}

/**
 * Get all products with pagination and search (server-side)
 */
export async function getAllProducts(
  page: number = 1,
  limit: number = 50,
  search: string = ''
): Promise<ProductsPaginationResult> {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return {
        products: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        limit
      }
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User not authenticated:', userError?.message || 'No user')
      return {
        products: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        limit
      }
    }

    // Build single optimized query with count and data
    // Only select necessary columns for list view (exclude large JSONB fields)
    let query = supabase
      .from('shoprenter_products')
      .select(`
        id,
        connection_id,
        shoprenter_id,
        shoprenter_inner_id,
        sku,
        model_number,
        gtin,
        name,
        brand,
        status,
        price,
        cost,
        multiplier,
        multiplier_lock,
        competitor_tracking_enabled,
        product_url,
        url_slug,
        url_alias_id,
        last_url_synced_at,
        last_synced_at,
        sync_status,
        sync_error,
        parent_product_id,
        created_at,
        updated_at,
        deleted_at
      `, { count: 'exact' })
      .is('deleted_at', null)

    // Apply search filter - use ilike with trigram indexes for better performance
    // Minimum 2 characters for search to avoid too many results
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim().replace(/'/g, "''") // Escape single quotes for SQL
      // Use ilike with %term% pattern - search in name, SKU, model_number (gyártói cikkszám), and GTIN
      query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,model_number.ilike.%${searchTerm}%,gtin.ilike.%${searchTerm}%`)
    }

    // Calculate pagination
    const offset = (page - 1) * limit

    // Get paginated results with count in single query
    const { data: products, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching products:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return {
        products: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        limit
      }
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return {
      products: products || [],
      totalCount,
      totalPages,
      currentPage: page,
      limit
    }
  } catch (error) {
    console.error('Exception in getAllProducts:', error instanceof Error ? error.message : String(error))
    return {
      products: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: page,
      limit
    }
  }
}

/**
 * Get a single product by ID with descriptions (server-side)
 */
export async function getProductById(id: string): Promise<ProductWithDescriptions | null> {
  try {
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

    // Get product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      console.error('Error fetching product:', productError)
      return null
    }

    // Get descriptions
    const { data: descriptions, error: descError } = await supabase
      .from('shoprenter_product_descriptions')
      .select('*')
      .eq('product_id', id)
      .order('language_code', { ascending: true })

    if (descError) {
      console.error('Error fetching descriptions:', descError)
    }

    return {
      ...product,
      descriptions: descriptions || []
    }
  } catch (error) {
    console.error('Exception in getProductById:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get quality scores for multiple products in batch (server-side)
 */
export async function getQualityScoresBatch(productIds: string[]): Promise<Map<string, any>> {
  if (productIds.length === 0) {
    return new Map()
  }

  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return new Map()
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User not authenticated:', userError?.message || 'No user')
      return new Map()
    }

    // Fetch quality scores in batch
    const { data: scores, error: scoresError } = await supabase
      .from('product_quality_scores')
      .select('product_id, overall_score, content_score, image_score, technical_score, performance_score, completeness_score, competitive_score, priority_score, is_parent, blocking_issues, issues, last_calculated_at')
      .in('product_id', productIds)

    if (scoresError) {
      console.error('Error fetching quality scores batch:', scoresError)
      return new Map()
    }

    // Convert to Map
    const scoresMap = new Map<string, any>()
    for (const score of scores || []) {
      scoresMap.set(score.product_id, score)
    }

    return scoresMap
  } catch (error) {
    console.error('Exception in getQualityScoresBatch:', error instanceof Error ? error.message : String(error))
    return new Map()
  }
}

/**
 * Get indexing statuses for multiple products in batch (server-side)
 */
export async function getIndexingStatusesBatch(productIds: string[]): Promise<Map<string, any>> {
  if (productIds.length === 0) {
    return new Map()
  }

  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return new Map()
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User not authenticated:', userError?.message || 'No user')
      return new Map()
    }

    // Fetch indexing statuses in batch
    const { data: statuses, error: statusError } = await supabase
      .from('product_indexing_status')
      .select('product_id, is_indexed, last_checked, coverage_state')
      .in('product_id', productIds)

    if (statusError) {
      console.error('Error fetching indexing statuses batch:', statusError)
      return new Map()
    }

    // Convert to Map
    const statusesMap = new Map<string, any>()
    for (const status of statuses || []) {
      statusesMap.set(status.product_id, status)
    }

    return statusesMap
  } catch (error) {
    console.error('Exception in getIndexingStatusesBatch:', error instanceof Error ? error.message : String(error))
    return new Map()
  }
}
