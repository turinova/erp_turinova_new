import CustomerQuoteHub from '@/components/muhely-ajanlat/CustomerQuoteHub'
import { getPortalCustomerQuotes } from '@/lib/supabase-server'

export const metadata = {
  title: 'Ügyfélajánlat - Turinova Ügyfélportál',
  description: 'Mentett ügyfélajánlataid'
}

export default async function UgyfelAjanlatHubPage() {
  const { quotes, error } = await getPortalCustomerQuotes(50)

  return <CustomerQuoteHub quotes={quotes} loadError={error || null} />
}
