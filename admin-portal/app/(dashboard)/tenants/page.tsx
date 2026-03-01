import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllTenants } from '@/lib/supabase-server'
import TenantsListClient from './TenantsListClient'

export const metadata: Metadata = {
  title: 'Ügyfelek - Turinova Admin'
}

// Loading skeleton component
function TenantsSkeleton() {
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

// Server-side rendered Tenants list page
export default async function TenantsPage() {
  const startTime = performance.now()

  // Fetch tenants data on the server
  const tenants = await getAllTenants()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Tenants Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<TenantsSkeleton />}>
      <TenantsListClient initialTenants={tenants} />
    </Suspense>
  )
}
