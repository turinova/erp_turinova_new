import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllSubscriptionPlans } from '@/lib/supabase-server'
import SubscriptionPlansListClient from './SubscriptionPlansListClient'

export const metadata: Metadata = {
  title: 'Előfizetési tervek - Turinova Admin'
}

// Loading skeleton component
function PlansSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Server-side rendered Subscription Plans list page
export default async function SubscriptionPlansPage() {
  const plans = await getAllSubscriptionPlans(true) // Include inactive plans

  return (
    <Suspense fallback={<PlansSkeleton />}>
      <SubscriptionPlansListClient initialPlans={plans} />
    </Suspense>
  )
}
