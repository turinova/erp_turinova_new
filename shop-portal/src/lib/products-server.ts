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
  name: string | null
  status: number
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
  shoprenter_id: string | null
  created_at: string
  updated_at: string
}

export interface ProductWithDescriptions extends ShopRenterProduct {
  descriptions: ShopRenterProductDescription[]
}

/**
 * Get all products (server-side)
 */
export async function getAllProducts(): Promise<ShopRenterProduct[]> {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return []
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
      return []
    }

    const { data: products, error } = await supabase
      .from('shoprenter_products')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching products:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return []
    }

    return products || []
  } catch (error) {
    console.error('Exception in getAllProducts:', error instanceof Error ? error.message : String(error))
    return []
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
