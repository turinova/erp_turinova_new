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
  status: number
  // Pricing fields (Árazás)
  price: number | null  // Nettó ár (Net price)
  cost: number | null  // Beszerzési ár (Cost/purchase price)
  multiplier: number | null  // Árazási szorzó (Price multiplier)
  multiplier_lock: boolean  // Szorzó zárolás (Multiplier lock)
  // URLs
  product_url: string | null
  url_slug: string | null
  canonical_url: string | null
  last_url_synced_at: string | null
  last_synced_at: string | null
  sync_status: string
  sync_error: string | null
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
    let query = supabase
      .from('shoprenter_products')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    // Apply search filter - use ilike with trigram indexes for better performance
    // Minimum 2 characters for search to avoid too many results
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim().replace(/'/g, "''") // Escape single quotes for SQL
      // Use ilike with %term% pattern - trigram indexes will make this fast
      query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
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
