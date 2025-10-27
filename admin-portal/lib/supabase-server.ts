import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin portal Supabase credentials (customer-portal-prod database)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

// Create an admin client with service role (for companies CRUD)
export const createAdminClient = () => {
  console.log('[Admin Client] Creating admin client')
  console.log('[Admin Client] Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.log('[Admin Client] Service Role Key:', supabaseServiceRoleKey ? '✅ Set' : '❌ Missing')
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase credentials for admin client')
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Get all companies with stats
 */
export async function getAllCompanies() {
  const supabase = createAdminClient()

  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Admin] Error fetching companies:', error)
    throw error
  }

  // Fetch stats for each company
  const companiesWithStats = await Promise.all(
    (companies || []).map(async (company) => {
      // Get customer count
      const { count: customerCount } = await supabase
        .from('portal_customers')
        .select('*', { count: 'exact', head: true })
        .eq('selected_company_id', company.id)

      // Get quote count
      const { count: quoteCount } = await supabase
        .from('portal_quotes')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)

      // Get last activity (most recent quote)
      const { data: lastQuote } = await supabase
        .from('portal_quotes')
        .select('created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return {
        ...company,
        customer_count: customerCount || 0,
        quote_count: quoteCount || 0,
        last_activity: lastQuote?.created_at || null
      }
    })
  )

  return companiesWithStats
}

/**
 * Get company by ID
 */
export async function getCompanyById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[Admin] Error fetching company:', error)
    throw error
  }

  return data
}

/**
 * Create new company
 */
export async function createCompany(companyData: any) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: companyData.name,
      slug: companyData.slug,
      supabase_url: companyData.supabase_url,
      supabase_anon_key: companyData.supabase_anon_key,
      is_active: companyData.is_active !== undefined ? companyData.is_active : true,
      logo_url: companyData.logo_url || null,
      settings: companyData.settings || {}
    })
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error creating company:', error)
    throw error
  }

  return data
}

/**
 * Update company
 */
export async function updateCompany(id: string, companyData: any) {
  console.log('[updateCompany] Starting update for company:', id)
  const supabase = createAdminClient()

  const updateData: any = {
    updated_at: new Date().toISOString()
  }

  if (companyData.name !== undefined) updateData.name = companyData.name
  if (companyData.slug !== undefined) updateData.slug = companyData.slug
  if (companyData.supabase_url !== undefined) updateData.supabase_url = companyData.supabase_url
  if (companyData.supabase_anon_key !== undefined) updateData.supabase_anon_key = companyData.supabase_anon_key
  if (companyData.is_active !== undefined) updateData.is_active = companyData.is_active
  if (companyData.logo_url !== undefined) updateData.logo_url = companyData.logo_url
  if (companyData.settings !== undefined) updateData.settings = companyData.settings

  console.log('[updateCompany] Update data:', updateData)

  const { data, error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  console.log('[updateCompany] Result:', { data, error })

  if (error) {
    console.error('[Admin] Error updating company:', error)
    throw error
  }

  return data
}

/**
 * Soft delete company (set is_active to false)
 */
export async function deleteCompany(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('companies')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error deleting company:', error)
    throw error
  }

  return data
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(url: string, anonKey: string) {
  try {
    const testClient = createSupabaseClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Try to fetch from a common table (this will fail gracefully if credentials are wrong)
    const { error } = await testClient.from('materials').select('id').limit(1)

    if (error && error.message.includes('JWT')) {
      return { success: false, error: 'Invalid Supabase credentials' }
    }

    return { success: true, error: null }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats() {
  const supabase = createAdminClient()

  // Total companies
  const { count: totalCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })

  // Active companies
  const { count: activeCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Total customers
  const { count: totalCustomers } = await supabase
    .from('portal_customers')
    .select('*', { count: 'exact', head: true })

  // Total quotes
  const { count: totalQuotes } = await supabase
    .from('portal_quotes')
    .select('*', { count: 'exact', head: true })

  // Quotes this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: quotesThisWeek } = await supabase
    .from('portal_quotes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString())

  // New customers this month
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count: newCustomersThisMonth } = await supabase
    .from('portal_customers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString())

  return {
    totalCompanies: totalCompanies || 0,
    activeCompanies: activeCompanies || 0,
    totalCustomers: totalCustomers || 0,
    totalQuotes: totalQuotes || 0,
    quotesThisWeek: quotesThisWeek || 0,
    newCustomersThisMonth: newCustomersThisMonth || 0
  }
}

/**
 * Get recent activity (quotes and customer registrations)
 */
export async function getRecentActivity(limit: number = 20) {
  const supabase = createAdminClient()

  // Get recent quotes
  const { data: recentQuotes } = await supabase
    .from('portal_quotes')
    .select(`
      id,
      quote_number,
      created_at,
      companies (id, name),
      portal_customers (name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit / 2)

  // Get recent customers
  const { data: recentCustomers } = await supabase
    .from('portal_customers')
    .select(`
      id,
      name,
      email,
      created_at,
      companies:selected_company_id (id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit / 2)

  // Combine and sort by date
  const activities = [
    ...(recentQuotes || []).map(q => ({
      type: 'quote' as const,
      id: q.id,
      timestamp: q.created_at,
      companyName: q.companies?.name || 'Unknown',
      details: `Quote #${q.quote_number} by ${q.portal_customers?.name || 'Unknown'}`
    })),
    ...(recentCustomers || []).map(c => ({
      type: 'customer' as const,
      id: c.id,
      timestamp: c.created_at,
      companyName: (c.companies as any)?.name || 'Unknown',
      details: `New customer: ${c.name} (${c.email})`
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return activities.slice(0, limit)
}


// Export alias for backwards compatibility
export { getDashboardStats as getCompanyStats }
