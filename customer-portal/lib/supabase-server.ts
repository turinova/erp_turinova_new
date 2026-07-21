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
        comment,
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

          // Fetch company quote info with payment details
          const { data: companyQuote, error: companyError } = await companySupabase
            .from('quotes')
            .select(`
              quote_number, 
              status,
              payment_status,
              payment_method_id,
              deleted_at,
              payment_methods(
                id,
                name
              )
            `)
            .eq('id', order.submitted_to_company_quote_id)
            .single()

          if (companyError) {
            console.error(`[Customer Portal SSR] Error fetching company quote ${order.submitted_to_company_quote_id}:`, companyError)
          }

          const isDeleted = Boolean(companyQuote?.deleted_at)
          const effectiveStatus = isDeleted ? 'deleted' : (companyQuote?.status || 'unknown')

          return {
            ...order,
            company_quote_number: companyQuote?.quote_number || 'N/A',
            company_quote_status: effectiveStatus,
            company_payment_status: companyQuote?.payment_status || null,
            company_payment_method: companyQuote?.payment_methods?.name || null
          }
        } catch (error) {
          console.error('[Customer Portal SSR] Error enriching order:', error)
          return {
            ...order,
            company_quote_number: 'Error',
            company_quote_status: 'unknown',
            company_payment_status: null,
            company_payment_method: null
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
        comment,
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

export type UnifiedPortalQuoteType = 'opti' | 'nettfront'

/**
 * Get single Nettfront portal quote by ID (detail + PDF)
 */
export async function getPortalNettfrontQuoteById(quoteId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) return null

    const { data: quote, error: quoteError } = await supabase
      .from('portal_nettfront_quotes')
      .select(
        `
        id,
        portal_customer_id,
        target_company_id,
        quote_number,
        status,
        comment,
        discount_percent,
        lines_total_net,
        lines_total_vat,
        lines_total_gross,
        services_total_net,
        services_total_vat,
        services_total_gross,
        total_net,
        total_vat,
        total_gross,
        final_total_after_discount,
        customer_snapshot,
        submitted_at,
        submitted_to_company_quote_id,
        created_at,
        updated_at,
        portal_customers!inner (
          id, name, email, mobile,
          billing_name, billing_country, billing_city, billing_postal_code,
          billing_street, billing_house_number, billing_tax_number, billing_company_reg_number,
          discount_percent
        ),
        companies!inner (
          id, name, supabase_url, supabase_anon_key
        )
      `
      )
      .eq('id', quoteId)
      .eq('portal_customer_id', user.id)
      .single()

    if (quoteError || !quote) {
      console.error('[Customer Portal SSR] Nettfront quote not found:', quoteError)
      return null
    }

    const { data: lines, error: linesError } = await supabase
      .from('portal_nettfront_quote_lines')
      .select('*')
      .eq('portal_nettfront_quote_id', quoteId)
      .order('sort_order', { ascending: true })

    if (linesError) {
      console.error('[Customer Portal SSR] Nettfront lines error:', linesError)
    }

    return {
      ...quote,
      lines: lines || [],
      portal_customers: Array.isArray(quote.portal_customers)
        ? quote.portal_customers[0]
        : quote.portal_customers,
      companies: Array.isArray(quote.companies) ? quote.companies[0] : quote.companies
    }
  } catch (error) {
    console.error('[Customer Portal SSR] getPortalNettfrontQuoteById:', error)
    return null
  }
}

/**
 * Unified draft list for /saved — Opti + Nettfront
 */
export async function getUnifiedSavedQuotes(page: number = 1, limit: number = 20, searchTerm?: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { quotes: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    const search = searchTerm?.trim() || ''

    let optiQuery = supabase
      .from('portal_quotes')
      .select('id, quote_number, comment, final_total_after_discount, updated_at')
      .eq('portal_customer_id', user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(200)

    let nfQuery = supabase
      .from('portal_nettfront_quotes')
      .select('id, quote_number, comment, final_total_after_discount, updated_at')
      .eq('portal_customer_id', user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(200)

    if (search) {
      optiQuery = optiQuery.ilike('quote_number', `%${search}%`)
      nfQuery = nfQuery.ilike('quote_number', `%${search}%`)
    }

    const [optiRes, nfRes] = await Promise.all([optiQuery, nfQuery])

    // If nettfront table missing (migration not run), ignore error and use Opti only
    const optiRows = (optiRes.data || []).map(q => ({
      id: q.id as string,
      quote_number: q.quote_number as string,
      comment: (q.comment as string | null) ?? null,
      final_total_after_discount: Number(q.final_total_after_discount) || 0,
      updated_at: q.updated_at as string,
      type: 'opti' as UnifiedPortalQuoteType
    }))

    const nfRows =
      nfRes.error
        ? []
        : (nfRes.data || []).map(q => ({
            id: q.id as string,
            quote_number: q.quote_number as string,
            comment: (q.comment as string | null) ?? null,
            final_total_after_discount: Number(q.final_total_after_discount) || 0,
            updated_at: q.updated_at as string,
            type: 'nettfront' as UnifiedPortalQuoteType
          }))

    if (nfRes.error) {
      console.warn('[Customer Portal SSR] Nettfront drafts unavailable:', nfRes.error.message)
    }

    const merged = [...optiRows, ...nfRows].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    const totalCount = merged.length
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))
    const offset = (page - 1) * limit
    const quotes = merged.slice(offset, offset + limit)

    return { quotes, totalCount, totalPages, currentPage: page }
  } catch (error) {
    console.error('[Customer Portal SSR] getUnifiedSavedQuotes:', error)
    return { quotes: [], totalCount: 0, totalPages: 0, currentPage: page }
  }
}

/**
 * Unified submitted list for /orders — Opti + Nettfront
 */
export async function getUnifiedOrders(page: number = 1, limit: number = 20, searchTerm?: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    const [optiRes, nfRes] = await Promise.all([
      supabase
        .from('portal_quotes')
        .select(
          `
          id, quote_number, comment, submitted_to_company_quote_id,
          final_total_after_discount, updated_at, submitted_at,
          companies!inner (id, name, supabase_url, supabase_anon_key)
        `
        )
        .eq('portal_customer_id', user.id)
        .eq('status', 'submitted')
        .not('submitted_to_company_quote_id', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(200),
      supabase
        .from('portal_nettfront_quotes')
        .select(
          `
          id, quote_number, comment, submitted_to_company_quote_id,
          final_total_after_discount, updated_at, submitted_at,
          companies!inner (id, name, supabase_url, supabase_anon_key)
        `
        )
        .eq('portal_customer_id', user.id)
        .eq('status', 'submitted')
        .not('submitted_to_company_quote_id', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(200)
    ])

    type CompanyEmbed = {
      id: string
      name: string
      supabase_url: string
      supabase_anon_key: string
    }

    const emptyTimestamps = () => ({
      ordered_at: null as string | null,
      in_production_at: null as string | null,
      ready_at: null as string | null,
      finished_at: null as string | null,
      cancelled_at: null as string | null
    })

    const lastStatusChangeAt = (
      submittedAt: string | null | undefined,
      ts: ReturnType<typeof emptyTimestamps>
    ) => {
      const candidates = [
        ts.cancelled_at,
        ts.finished_at,
        ts.ready_at,
        ts.in_production_at,
        ts.ordered_at,
        submittedAt
      ].filter(Boolean) as string[]
      if (!candidates.length) return submittedAt || null
      return candidates.reduce((latest, cur) =>
        new Date(cur).getTime() > new Date(latest).getTime() ? cur : latest
      )
    }

    const enrichOpti = async (order: Record<string, unknown>) => {
      const companies = (
        Array.isArray(order.companies) ? order.companies[0] : order.companies
      ) as CompanyEmbed
      const submittedAt = order.submitted_at as string
      const base = {
        id: order.id as string,
        quote_number: order.quote_number as string,
        comment: (order.comment as string | null) ?? null,
        submitted_to_company_quote_id: order.submitted_to_company_quote_id as string,
        final_total_after_discount: Number(order.final_total_after_discount) || 0,
        updated_at: order.updated_at as string,
        submitted_at: submittedAt,
        type: 'opti' as UnifiedPortalQuoteType,
        companies: { id: companies.id, name: companies.name }
      }
      try {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
        const companySupabase = createSupabaseClient(companies.supabase_url, companies.supabase_anon_key)
        const { data: companyQuote } = await companySupabase
          .from('quotes')
          .select(
            `
            quote_number, status, payment_status, deleted_at,
            ordered_at, in_production_at, ready_at, finished_at, cancelled_at,
            payment_methods (id, name)
          `
          )
          .eq('id', order.submitted_to_company_quote_id as string)
          .single()

        const isDeleted = Boolean(companyQuote?.deleted_at)
        const pm = companyQuote?.payment_methods as { name?: string } | { name?: string }[] | null
        const pmName = Array.isArray(pm) ? pm[0]?.name : pm?.name
        const timestamps = {
          ordered_at: (companyQuote?.ordered_at as string | null) ?? null,
          in_production_at: (companyQuote?.in_production_at as string | null) ?? null,
          ready_at: (companyQuote?.ready_at as string | null) ?? null,
          finished_at: (companyQuote?.finished_at as string | null) ?? null,
          cancelled_at: (companyQuote?.cancelled_at as string | null) ?? null
        }

        return {
          ...base,
          company_quote_number: companyQuote?.quote_number || 'N/A',
          company_quote_status: isDeleted ? 'deleted' : companyQuote?.status || 'unknown',
          company_payment_status: companyQuote?.payment_status || null,
          company_payment_method: pmName || null,
          status_timestamps: timestamps,
          last_status_change_at: lastStatusChangeAt(submittedAt, timestamps)
        }
      } catch {
        const timestamps = emptyTimestamps()
        return {
          ...base,
          company_quote_number: 'Error',
          company_quote_status: 'unknown',
          company_payment_status: null,
          company_payment_method: null,
          status_timestamps: timestamps,
          last_status_change_at: lastStatusChangeAt(submittedAt, timestamps)
        }
      }
    }

    const enrichNf = async (order: Record<string, unknown>) => {
      const companies = (
        Array.isArray(order.companies) ? order.companies[0] : order.companies
      ) as CompanyEmbed
      const submittedAt = order.submitted_at as string
      const base = {
        id: order.id as string,
        quote_number: order.quote_number as string,
        comment: (order.comment as string | null) ?? null,
        submitted_to_company_quote_id: order.submitted_to_company_quote_id as string,
        final_total_after_discount: Number(order.final_total_after_discount) || 0,
        updated_at: order.updated_at as string,
        submitted_at: submittedAt,
        type: 'nettfront' as UnifiedPortalQuoteType,
        companies: { id: companies.id, name: companies.name }
      }
      try {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
        const companySupabase = createSupabaseClient(companies.supabase_url, companies.supabase_anon_key)
        const { data: companyQuote } = await companySupabase
          .from('fronttervezo_quotes')
          .select(
            `
            quote_number, order_number, status, payment_status, deleted_at,
            ordered_at, ready_at, finished_at, cancelled_at,
            payment_methods (id, name)
          `
          )
          .eq('id', order.submitted_to_company_quote_id as string)
          .single()

        const isDeleted = Boolean(companyQuote?.deleted_at)
        const pm = companyQuote?.payment_methods as { name?: string } | { name?: string }[] | null
        const pmName = Array.isArray(pm) ? pm[0]?.name : pm?.name
        const timestamps = {
          ordered_at: (companyQuote?.ordered_at as string | null) ?? null,
          in_production_at: null as string | null,
          ready_at: (companyQuote?.ready_at as string | null) ?? null,
          finished_at: (companyQuote?.finished_at as string | null) ?? null,
          cancelled_at: (companyQuote?.cancelled_at as string | null) ?? null
        }

        return {
          ...base,
          company_quote_number:
            companyQuote?.order_number || companyQuote?.quote_number || 'N/A',
          company_quote_status: isDeleted ? 'deleted' : companyQuote?.status || 'unknown',
          company_payment_status: companyQuote?.payment_status || null,
          company_payment_method: pmName || null,
          status_timestamps: timestamps,
          last_status_change_at: lastStatusChangeAt(submittedAt, timestamps)
        }
      } catch {
        const timestamps = emptyTimestamps()
        return {
          ...base,
          company_quote_number: 'Error',
          company_quote_status: 'unknown',
          company_payment_status: null,
          company_payment_method: null,
          status_timestamps: timestamps,
          last_status_change_at: lastStatusChangeAt(submittedAt, timestamps)
        }
      }
    }

    const optiOrders = await Promise.all((optiRes.data || []).map(o => enrichOpti(o as Record<string, unknown>)))
    const nfOrders = nfRes.error
      ? []
      : await Promise.all((nfRes.data || []).map(o => enrichNf(o as Record<string, unknown>)))

    if (nfRes.error) {
      console.warn('[Customer Portal SSR] Nettfront orders unavailable:', nfRes.error.message)
    }

    let merged = [...optiOrders, ...nfOrders].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )

    const search = searchTerm?.trim().toLowerCase()
    if (search) {
      merged = merged.filter(
        o =>
          o.quote_number.toLowerCase().includes(search) ||
          o.company_quote_number.toLowerCase().includes(search)
      )
    }

    const totalCount = merged.length
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))
    const offset = (page - 1) * limit

    return {
      orders: merged.slice(offset, offset + limit),
      totalCount,
      totalPages,
      currentPage: page
    }
  } catch (error) {
    console.error('[Customer Portal SSR] getUnifiedOrders:', error)
    return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
  }
}
