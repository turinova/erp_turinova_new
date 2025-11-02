import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import HomeClient from './HomeClient'

export const metadata = {
  title: 'Kezdőlap - Turinova Ügyfélportál',
  description: 'Turinova ügyfélportál kezdőlap'
}

export default async function HomePage() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('[Home SSR] User not authenticated:', userError)
      return <div>Nem sikerült betölteni a felhasználói adatokat</div>
    }

    // Fetch customer data with selected company
    const { data: customer, error: customerError } = await supabase
      .from('portal_customers')
      .select(`
        id,
        name,
        selected_company_id,
        companies:selected_company_id (
          id,
          name,
          supabase_url,
          supabase_anon_key
        )
      `)
      .eq('id', user.id)
      .single()

    if (customerError || !customer) {
      console.error('[Home SSR] Error fetching customer:', customerError)
      return <div>Nem sikerült betölteni az ügyfél adatokat</div>
    }

    const companyName = customer.companies?.name || 'Nincs kiválasztva'

    // Fetch saved quotes count (draft status, not submitted)
    const { count: savedQuotesCount } = await supabase
      .from('portal_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('portal_customer_id', user.id)
      .eq('status', 'draft')

    // Fetch ALL submitted orders (from all companies)
    const { data: allOrders, error: ordersError } = await supabase
      .from('portal_quotes')
      .select(`
        id,
        submitted_to_company_quote_id,
        companies!inner (
          supabase_url,
          supabase_anon_key
        )
      `)
      .eq('portal_customer_id', user.id)
      .eq('status', 'submitted')
      .not('submitted_to_company_quote_id', 'is', null)

    if (ordersError) {
      console.error('[Home SSR] Error fetching orders:', ordersError)
    }

    // Fetch company quote statuses for all orders
    const ordersWithStatus = await Promise.all(
      (allOrders || []).map(async (order) => {
        try {
          const companySupabase = createSupabaseClient(
            order.companies.supabase_url,
            order.companies.supabase_anon_key
          )

          const { data: companyQuote } = await companySupabase
            .from('quotes')
            .select('status')
            .eq('id', order.submitted_to_company_quote_id)
            .single()

          return companyQuote?.status || 'unknown'
        } catch {
          return 'unknown'
        }
      })
    )

    // Calculate statistics
    const totalOrders = allOrders?.length || 0
    const inProgressCount = ordersWithStatus.filter(s => s === 'ordered' || s === 'in_production').length
    const finishedCount = ordersWithStatus.filter(s => s === 'finished').length

    console.log(`[Home SSR] Stats - Saved: ${savedQuotesCount}, Total Orders: ${totalOrders}, In Progress: ${inProgressCount}, Finished: ${finishedCount}`)

    return (
      <HomeClient
        customerName={customer.name}
        companyName={companyName}
        savedQuotesCount={savedQuotesCount || 0}
        totalOrdersCount={totalOrders}
        inProgressCount={inProgressCount}
        finishedCount={finishedCount}
      />
    )
  } catch (error) {
    console.error('[Home SSR] Error:', error)
    return <div>Hiba történt az oldal betöltése során</div>
  }
}
