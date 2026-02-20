// Server-side Competitors Utilities
// For use in server components and API routes

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface Competitor {
  id: string
  name: string
  website_url: string
  scrape_config: Record<string, any>
  is_active: boolean
  last_scraped_at: string | null
  created_at: string
  updated_at: string
}

export interface CompetitorProductLink {
  id: string
  product_id: string
  competitor_id: string
  competitor_url: string
  competitor_sku: string | null
  competitor_product_name: string | null
  matching_method: string
  matching_confidence: number | null
  is_active: boolean
  last_checked_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
  // Joined data
  competitor?: Competitor
  product?: {
    id: string
    sku: string
    name: string | null
    model_number: string | null
    gtin: string | null
    price: number | null
  }
}

export interface CompetitorPrice {
  id: string
  competitor_product_link_id: string
  price: number | null
  original_price: number | null
  currency: string
  in_stock: boolean | null
  extracted_product_name: string | null
  extracted_data: Record<string, any> | null
  raw_html_hash: string | null
  scrape_duration_ms: number | null
  ai_model_used: string | null
  scraped_at: string
}

export interface CompetitorWithStats extends Competitor {
  product_count: number
  last_price_check: string | null
}

// Helper to create Supabase client
const getSupabaseClient = async () => {
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    throw new Error('Supabase environment variables are not set.')
  }

  return createServerClient(
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
}

/**
 * Get all competitors
 */
export async function getAllCompetitors(): Promise<Competitor[]> {
  const supabase = await getSupabaseClient()

  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching competitors:', error)
    return []
  }

  return data as Competitor[]
}

/**
 * Get competitor by ID
 */
export async function getCompetitorById(id: string): Promise<Competitor | null> {
  const supabase = await getSupabaseClient()

  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching competitor:', error)
    return null
  }

  return data as Competitor
}

/**
 * Create a new competitor
 */
export async function createCompetitor(data: {
  name: string
  website_url: string
  scrape_config?: Record<string, any>
  is_active?: boolean
}): Promise<Competitor | null> {
  const supabase = await getSupabaseClient()

  const { data: competitor, error } = await supabase
    .from('competitors')
    .insert({
      name: data.name,
      website_url: data.website_url,
      scrape_config: data.scrape_config || {},
      is_active: data.is_active ?? true
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating competitor:', error)
    return null
  }

  return competitor as Competitor
}

/**
 * Update a competitor
 */
export async function updateCompetitor(
  id: string,
  data: Partial<Competitor>
): Promise<boolean> {
  const supabase = await getSupabaseClient()

  const { error } = await supabase
    .from('competitors')
    .update(data)
    .eq('id', id)

  if (error) {
    console.error('Error updating competitor:', error)
    return false
  }

  return true
}

/**
 * Delete a competitor
 */
export async function deleteCompetitor(id: string): Promise<boolean> {
  const supabase = await getSupabaseClient()

  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting competitor:', error)
    return false
  }

  return true
}

/**
 * Get all product links for a competitor
 */
export async function getCompetitorProductLinks(
  competitorId: string
): Promise<CompetitorProductLink[]> {
  const supabase = await getSupabaseClient()

  const { data, error } = await supabase
    .from('competitor_product_links')
    .select(`
      *,
      product:shoprenter_products(id, sku, name, model_number, gtin, price)
    `)
    .eq('competitor_id', competitorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching competitor product links:', error)
    return []
  }

  return data as CompetitorProductLink[]
}

/**
 * Get price history for a product link
 */
export async function getCompetitorPriceHistory(
  linkId: string,
  limit: number = 30
): Promise<CompetitorPrice[]> {
  const supabase = await getSupabaseClient()

  const { data, error } = await supabase
    .from('competitor_prices')
    .select('*')
    .eq('competitor_product_link_id', linkId)
    .order('scraped_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching price history:', error)
    return []
  }

  return data as CompetitorPrice[]
}

/**
 * Get latest prices for all competitors of a product
 */
export async function getProductCompetitorPrices(
  productId: string
): Promise<{
  competitor: Competitor
  link: CompetitorProductLink
  latestPrice: CompetitorPrice | null
}[]> {
  const supabase = await getSupabaseClient()

  const { data: links, error } = await supabase
    .from('competitor_product_links')
    .select(`
      *,
      competitor:competitors(*),
      prices:competitor_prices(*)
    `)
    .eq('product_id', productId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching product competitor prices:', error)
    return []
  }

  return (links || []).map((link: any) => {
    // Get the latest price
    const sortedPrices = (link.prices || []).sort(
      (a: CompetitorPrice, b: CompetitorPrice) => 
        new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
    )

    return {
      competitor: link.competitor as Competitor,
      link: { ...link, competitor: undefined, prices: undefined } as CompetitorProductLink,
      latestPrice: sortedPrices[0] || null
    }
  })
}

/**
 * Create or update a competitor product link
 */
export async function upsertCompetitorProductLink(data: {
  product_id: string
  competitor_id: string
  competitor_url: string
  competitor_sku?: string | null
  competitor_product_name?: string | null
  matching_method?: string
  matching_confidence?: number | null
}): Promise<CompetitorProductLink | null> {
  const supabase = await getSupabaseClient()

  const { data: link, error } = await supabase
    .from('competitor_product_links')
    .upsert({
      product_id: data.product_id,
      competitor_id: data.competitor_id,
      competitor_url: data.competitor_url,
      competitor_sku: data.competitor_sku || null,
      competitor_product_name: data.competitor_product_name || null,
      matching_method: data.matching_method || 'manual',
      matching_confidence: data.matching_confidence || null,
      is_active: true
    }, {
      onConflict: 'product_id,competitor_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting competitor product link:', error)
    return null
  }

  return link as CompetitorProductLink
}

/**
 * Record a new price for a competitor product
 */
export async function recordCompetitorPrice(data: {
  competitor_product_link_id: string
  price: number | null
  original_price?: number | null
  currency?: string
  in_stock?: boolean | null
  extracted_product_name?: string | null
  extracted_data?: Record<string, any> | null
  raw_html_hash?: string | null
  scrape_duration_ms?: number | null
  ai_model_used?: string | null
}): Promise<CompetitorPrice | null> {
  const supabase = await getSupabaseClient()

  const { data: price, error } = await supabase
    .from('competitor_prices')
    .insert({
      competitor_product_link_id: data.competitor_product_link_id,
      price: data.price,
      original_price: data.original_price || null,
      currency: data.currency || 'HUF',
      in_stock: data.in_stock ?? null,
      extracted_product_name: data.extracted_product_name || null,
      extracted_data: data.extracted_data || null,
      raw_html_hash: data.raw_html_hash || null,
      scrape_duration_ms: data.scrape_duration_ms || null,
      ai_model_used: data.ai_model_used || null
    })
    .select()
    .single()

  if (error) {
    console.error('Error recording competitor price:', error)
    return null
  }

  // Update last_checked_at on the link
  await supabase
    .from('competitor_product_links')
    .update({ last_checked_at: new Date().toISOString(), last_error: null })
    .eq('id', data.competitor_product_link_id)

  return price as CompetitorPrice
}
