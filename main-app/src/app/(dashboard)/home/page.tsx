import type { Metadata } from 'next'
import HomeClient from './HomeClient'
import { getCustomerPortalDraftQuotes } from '@/lib/supabase-server'
import { 
  getMonthlyQuotesData, 
  getMonthlySupplierOrdersData, 
  getWeeklyCuttingData 
} from '@/lib/dashboard-server'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

export default async function Page() {
  // Fetch all dashboard data in parallel with SSR for optimal performance
  const [customerPortalQuotes, monthlyQuotes, monthlySupplierOrders, weeklyCutting] = await Promise.all([
    getCustomerPortalDraftQuotes(),
    getMonthlyQuotesData('month', 0),
    getMonthlySupplierOrdersData('month', 0),
    getWeeklyCuttingData(0)
  ])
  
  return (
    <HomeClient 
      customerPortalQuotes={customerPortalQuotes}
      initialMonthlyQuotes={monthlyQuotes}
      initialMonthlySupplierOrders={monthlySupplierOrders}
      initialWeeklyCutting={weeklyCutting}
    />
  )
}
