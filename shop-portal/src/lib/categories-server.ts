/**
 * Categories Server-Side Helper Functions
 * Functions for working with categories in server components and API routes
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: string) {
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

  const { data: category, error } = await supabase
    .from('shoprenter_categories')
    .select('*')
    .eq('id', categoryId)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('[Categories Server] Error fetching category:', error)
    return null
  }

  return category
}

/**
 * Get category with descriptions
 */
export async function getCategoryWithDescriptions(categoryId: string) {
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

  const { data: category, error: categoryError } = await supabase
    .from('shoprenter_categories')
    .select(`
      *,
      shoprenter_category_descriptions(*)
    `)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .single()

  if (categoryError) {
    console.error('[Categories Server] Error fetching category with descriptions:', categoryError)
    return null
  }

  return category
}

/**
 * Get categories for a connection
 */
export async function getCategoriesForConnection(connectionId: string) {
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

  const { data: categories, error } = await supabase
    .from('shoprenter_categories')
    .select(`
      *,
      shoprenter_category_descriptions(*)
    `)
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('[Categories Server] Error fetching categories:', error)
    return []
  }

  return categories || []
}

/**
 * Get products in a category
 */
export async function getProductsInCategory(categoryId: string) {
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

  const { data: relations, error: relationsError } = await supabase
    .from('shoprenter_product_category_relations')
    .select(`
      product_id,
      shoprenter_products!inner(
        id,
        sku,
        name,
        status,
        price,
        product_url,
        shoprenter_product_descriptions(name, description)
      )
    `)
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .is('shoprenter_products.deleted_at', null)

  if (relationsError) {
    console.error('[Categories Server] Error fetching products in category:', relationsError)
    return []
  }

  // Extract products from relations
  const products = (relations || [])
    .map(rel => rel.shoprenter_products)
    .filter(Boolean)

  return products
}

/**
 * Get category hierarchy (parent chain)
 */
export async function getCategoryHierarchy(categoryId: string): Promise<any[]> {
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

  const hierarchy: any[] = []
  let currentCategoryId: string | null = categoryId

  // Walk up the parent chain
  while (currentCategoryId) {
    const { data: category, error } = await supabase
      .from('shoprenter_categories')
      .select('*')
      .eq('id', currentCategoryId)
      .is('deleted_at', null)
      .single()

    if (error || !category) {
      break
    }

    hierarchy.unshift(category) // Add to beginning
    currentCategoryId = category.parent_category_id
  }

  return hierarchy
}

/**
 * Get categories for a product
 */
export async function getCategoriesForProduct(productId: string) {
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

  const { data: relations, error } = await supabase
    .from('shoprenter_product_category_relations')
    .select(`
      category_id,
      shoprenter_categories(
        id,
        name,
        url_slug,
        category_url,
        shoprenter_category_descriptions(name, description)
      )
    `)
    .eq('product_id', productId)
    .is('deleted_at', null)

  if (error) {
    console.error('[Categories Server] Error fetching categories for product:', error)
    return []
  }

  // Extract categories from relations
  const categories = (relations || [])
    .map(rel => rel.shoprenter_categories)
    .filter(Boolean)

  return categories
}
