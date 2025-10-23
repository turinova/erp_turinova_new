import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Customer portal Supabase credentials
const supabaseUrl = 'https://oatbbtbkerxogzvwicxx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk1MjU5MiwiZXhwIjoyMDc2NTI4NTkyfQ.95wpFs18T3xwsR8TOPjuA-GgA9L0IdaLdtXxdQVp7KU'

// Create a standard server client (for authenticated API routes)
export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `cookies().set()` method can only be called from a Server Component
          // or Server Action. Let's ignore this error on the client.
        }
      },
    },
  })
}

// Create an admin client (for server-side operations like registration)
export const createAdminClient = () => {
  return createServerClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // No-op for admin client
      },
    },
  })
}

/**
 * Get single portal quote by ID (for quote detail page)
 * Fetches complete quote data including panels, pricing, edges, and services
 */
export async function getPortalQuoteById(quoteId: string) {
  const startTime = performance.now()
  
  console.log(`[Customer Portal SSR] Fetching portal quote: ${quoteId}`)

  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('[Customer Portal SSR] User not authenticated:', userError)
      return null
    }

    // Fetch quote with all related data
    const { data: quote, error: quoteError } = await supabase
      .from('portal_quotes')
      .select(`
        id,
        portal_customer_id,
        target_company_id,
        quote_number,
        status,
        comment,
        total_net,
        total_vat,
        total_gross,
        discount_percent,
        final_total_after_discount,
        created_at,
        updated_at,
        portal_customers!inner (
          id,
          name,
          email,
          mobile,
          billing_name,
          billing_country,
          billing_city,
          billing_postal_code,
          billing_street,
          billing_house_number,
          billing_tax_number,
          billing_company_reg_number,
          discount_percent
        ),
        companies!inner (
          id,
          name,
          supabase_url,
          supabase_anon_key
        )
      `)
      .eq('id', quoteId)
      .eq('portal_customer_id', user.id) // Only fetch own quotes
      .single()

    if (quoteError || !quote) {
      console.error('[Customer Portal SSR] Quote not found or access denied:', quoteError)
      return null
    }

    // Fetch panels
    const { data: panels, error: panelsError } = await supabase
      .from('portal_quote_panels')
      .select('*')
      .eq('portal_quote_id', quoteId)
      .order('created_at', { ascending: true })

    if (panelsError) {
      console.error('[Customer Portal SSR] Error fetching panels:', panelsError)
    }

    // Fetch pricing with edge materials and services breakdown
    const { data: pricing, error: pricingError } = await supabase
      .from('portal_quote_materials_pricing')
      .select(`
        *,
        portal_quote_edge_materials_breakdown (*),
        portal_quote_services_breakdown (*)
      `)
      .eq('portal_quote_id', quoteId)
      .order('created_at', { ascending: true })

    if (pricingError) {
      console.error('[Customer Portal SSR] Error fetching pricing:', pricingError)
    }

    // Build edge material lookup from breakdown data for the cutting list
    // Map edge_material_id to edge_material_name (type-width/thickness-decor)
    const edgeMaterialLookup = new Map<string, string>()
    pricing?.forEach(p => {
      p.portal_quote_edge_materials_breakdown?.forEach(edge => {
        if (!edgeMaterialLookup.has(edge.edge_material_id)) {
          edgeMaterialLookup.set(edge.edge_material_id, edge.edge_material_name)
        }
      })
    })

    // Enrich panels with edge material names for cutting list
    const enrichedPanels = panels?.map(panel => ({
      ...panel,
      edge_a_name: panel.edge_material_a_id ? edgeMaterialLookup.get(panel.edge_material_a_id) || null : null,
      edge_b_name: panel.edge_material_b_id ? edgeMaterialLookup.get(panel.edge_material_b_id) || null : null,
      edge_c_name: panel.edge_material_c_id ? edgeMaterialLookup.get(panel.edge_material_c_id) || null : null,
      edge_d_name: panel.edge_material_d_id ? edgeMaterialLookup.get(panel.edge_material_d_id) || null : null
    })) || []

    const queryTime = performance.now()
    console.log(`[Customer Portal SSR] Quote fetched in ${(queryTime - startTime).toFixed(2)}ms`)

    return {
      ...quote,
      panels: enrichedPanels,
      pricing: pricing || []
    }

  } catch (error) {
    console.error('[Customer Portal SSR] Error fetching portal quote:', error)
    return null
  }
}

/**
 * Get portal orders with pagination (for orders page)
 * Fetches submitted quotes with company quote info
 */
export async function getPortalOrdersWithPagination(page: number = 1, limit: number = 20, searchTerm?: string) {
  const startTime = performance.now()
  
  console.log(`[Customer Portal SSR] Fetching portal orders page ${page}, limit ${limit}, search: "${searchTerm || 'none'}"`)

  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('[Customer Portal SSR] User not authenticated:', userError)
      return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    const offset = (page - 1) * limit
    
    // Build query - fetch submitted quotes with company info
    let query = supabase
      .from('portal_quotes')
      .select(`
        id,
        quote_number,
        submitted_to_company_quote_id,
        final_total_after_discount,
        updated_at,
        submitted_at,
        companies!inner (
          id,
          name,
          supabase_url,
          supabase_anon_key
        )
      `, { count: 'exact' })
      .eq('portal_customer_id', user.id) // Only this customer's quotes
      .eq('status', 'submitted') // Only submitted quotes
      .not('submitted_to_company_quote_id', 'is', null) // Must have company quote link
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: orders, error: ordersError, count } = await query

    if (ordersError) {
      console.error('[Customer Portal SSR] Error fetching portal orders:', ordersError)
      return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    // For each order, fetch company quote number and status from company DB
    const enrichedOrders = await Promise.all(
      (orders || []).map(async (order) => {
        try {
          const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
          const companySupabase = createSupabaseClient(
            order.companies.supabase_url,
            order.companies.supabase_anon_key
          )

          // Fetch company quote info
          const { data: companyQuote, error: companyError } = await companySupabase
            .from('quotes')
            .select('quote_number, status')
            .eq('id', order.submitted_to_company_quote_id)
            .single()

          if (companyError) {
            console.error(`[Customer Portal SSR] Error fetching company quote ${order.submitted_to_company_quote_id}:`, companyError)
          }

          return {
            ...order,
            company_quote_number: companyQuote?.quote_number || 'N/A',
            company_quote_status: companyQuote?.status || 'unknown'
          }
        } catch (error) {
          console.error('[Customer Portal SSR] Error enriching order:', error)
          return {
            ...order,
            company_quote_number: 'Error',
            company_quote_status: 'unknown'
          }
        }
      })
    )

    // Apply search filter if provided (search by company quote number)
    let filteredOrders = enrichedOrders
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase()
      filteredOrders = enrichedOrders.filter(order => 
        order.company_quote_number.toLowerCase().includes(searchLower)
      )
    }

    const totalCount = searchTerm ? filteredOrders.length : (count || 0)
    const totalPages = Math.ceil(totalCount / limit)

    const queryTime = performance.now()
    console.log(`[Customer Portal SSR] Orders fetched in ${(queryTime - startTime).toFixed(2)}ms - ${enrichedOrders.length} orders`)
    
    return {
      orders: searchTerm ? filteredOrders : enrichedOrders,
      totalCount,
      totalPages,
      currentPage: page
    }

  } catch (error) {
    console.error('[Customer Portal SSR] Error fetching portal orders:', error)
    return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
  }
}

/**
 * Get portal quotes with pagination (for saved quotes page)
 * Fetches only draft quotes for the logged-in portal customer
 */
export async function getPortalQuotesWithPagination(page: number = 1, limit: number = 20, searchTerm?: string) {
  const startTime = performance.now()
  
  console.log(`[Customer Portal SSR] Fetching portal quotes page ${page}, limit ${limit}, search: "${searchTerm || 'none'}"`)

  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('[Customer Portal SSR] User not authenticated:', userError)
      return { quotes: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    const offset = (page - 1) * limit
    
    // Build query - only fetch quotes for logged-in customer
    let query = supabase
      .from('portal_quotes')
      .select(`
        id,
        quote_number,
        final_total_after_discount,
        updated_at
      `, { count: 'exact' })
      .eq('portal_customer_id', user.id) // Only this customer's quotes
      .eq('status', 'draft') // Only draft quotes (not submitted)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply search filter if provided (search by quote number)
    if (searchTerm && searchTerm.trim()) {
      query = query.ilike('quote_number', `%${searchTerm.trim()}%`)
    }

    const { data: quotes, error: quotesError, count } = await query

    if (quotesError) {
      console.error('[Customer Portal SSR] Error fetching portal quotes:', quotesError)
      const queryTime = performance.now()
      console.log(`[Customer Portal SSR] Quotes Fetch Failed: ${(queryTime - startTime).toFixed(2)}ms`)
      return { quotes: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    const queryTime = performance.now()
    console.log(`[Customer Portal SSR] Quotes Fetch Total: ${(queryTime - startTime).toFixed(2)}ms - returned ${quotes?.length || 0} quotes (page ${page}/${totalPages})`)
    console.log(`[Customer Portal SSR] Portal quotes fetched successfully: ${quotes?.length || 0} quotes, total: ${totalCount}`)
    
    return {
      quotes: quotes || [],
      totalCount,
      totalPages,
      currentPage: page
    }

  } catch (error) {
    console.error('[Customer Portal SSR] Error fetching portal quotes:', error)
    const queryTime = performance.now()
    console.log(`[Customer Portal SSR] Quotes Fetch Error: ${(queryTime - startTime).toFixed(2)}ms`)
    return { quotes: [], totalCount: 0, totalPages: 0, currentPage: page }
  }
}
