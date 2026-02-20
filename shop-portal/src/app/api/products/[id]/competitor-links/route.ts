import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/products/[id]/competitor-links
 * Get all competitor links for a product with latest prices
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all competitor links for this product
    const { data: links, error } = await supabase
      .from('competitor_product_links')
      .select(`
        *,
        competitor:competitors(*)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching competitor links:', error)
      return NextResponse.json({ error: 'Failed to fetch competitor links' }, { status: 500 })
    }

    // For each link, get the latest price
    const linksWithPrices = await Promise.all((links || []).map(async (link) => {
      const { data: prices } = await supabase
        .from('competitor_prices')
        .select('*')
        .eq('competitor_product_link_id', link.id)
        .order('scraped_at', { ascending: false })
        .limit(5)

      return {
        ...link,
        prices: prices || [],
        latestPrice: prices?.[0] || null
      }
    }))

    return NextResponse.json(linksWithPrices)
  } catch (error) {
    console.error('Error fetching competitor links:', error)
    return NextResponse.json({ error: 'Failed to fetch competitor links' }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/competitor-links
 * Create a new competitor link for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { competitor_id, competitor_url, competitor_sku, competitor_product_name } = body

    if (!competitor_id || !competitor_url) {
      return NextResponse.json(
        { error: 'Versenytárs és URL megadása kötelező' },
        { status: 400 }
      )
    }

    // Check if link already exists
    const { data: existing } = await supabase
      .from('competitor_product_links')
      .select('id')
      .eq('product_id', productId)
      .eq('competitor_id', competitor_id)
      .single()

    if (existing) {
      // Update existing link
      const { data: link, error } = await supabase
        .from('competitor_product_links')
        .update({
          competitor_url,
          competitor_sku: competitor_sku || null,
          competitor_product_name: competitor_product_name || null,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select(`
          *,
          competitor:competitors(*)
        `)
        .single()

      if (error) {
        console.error('Error updating competitor link:', error)
        return NextResponse.json({ error: 'Failed to update competitor link' }, { status: 500 })
      }

      return NextResponse.json({ success: true, link, updated: true })
    }

    // Create new link
    const { data: link, error } = await supabase
      .from('competitor_product_links')
      .insert({
        product_id: productId,
        competitor_id,
        competitor_url,
        competitor_sku: competitor_sku || null,
        competitor_product_name: competitor_product_name || null,
        matching_method: 'manual',
        is_active: true
      })
      .select(`
        *,
        competitor:competitors(*)
      `)
      .single()

    if (error) {
      console.error('Error creating competitor link:', error)
      return NextResponse.json({ error: 'Failed to create competitor link' }, { status: 500 })
    }

    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('Error creating competitor link:', error)
    return NextResponse.json({ error: 'Failed to create competitor link' }, { status: 500 })
  }
}
