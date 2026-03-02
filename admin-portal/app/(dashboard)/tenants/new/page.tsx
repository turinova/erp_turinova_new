import React from 'react'
import type { Metadata } from 'next'
import { getAllSubscriptionPlans } from '@/lib/supabase-server'
import TenantNewClient from './TenantNewClient'

export const metadata: Metadata = {
  title: 'Új ügyfél - Turinova Admin'
}

export default async function NewTenantPage() {
  const plans = await getAllSubscriptionPlans(false) // Only active plans

  return <TenantNewClient initialPlans={plans} />
}
