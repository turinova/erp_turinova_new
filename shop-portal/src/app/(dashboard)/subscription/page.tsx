import { notFound } from 'next/navigation'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import SubscriptionPageClient from './SubscriptionPageClient'

export default async function SubscriptionPage() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      notFound()
    }

    return <SubscriptionPageClient />
  } catch (error) {
    console.error('Error in SubscriptionPage:', error)
    notFound()
  }
}
