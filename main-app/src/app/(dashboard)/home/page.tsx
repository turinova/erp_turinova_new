import HomeClient from './HomeClient'
import { getCustomerPortalDraftQuotes } from '@/lib/supabase-server'

export default async function Page() {
  // Fetch customer portal draft quotes with SSR
  const customerPortalQuotes = await getCustomerPortalDraftQuotes()
  
  return <HomeClient customerPortalQuotes={customerPortalQuotes} />
}
