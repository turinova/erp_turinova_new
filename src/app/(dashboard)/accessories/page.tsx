import React, { Suspense } from 'react'
import { getAccessoriesWithPagination } from '@/lib/supabase-server'
import AccessoriesListClient from './AccessoriesListClient'

interface Accessory {
  id: string
  name: string
  sku: string
  base_price: number
  multiplier: number
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  created_at: string
  updated_at: string
  vat_name: string
  vat_percent: number
  currency_name: string
  unit_name: string
  unit_shortform: string
  partner_name: string
  vat_amount: number
  gross_price: number
}

interface PageProps {
  searchParams: Promise<{ page?: string; limit?: string }>
}

// Loading skeleton component
function AccessoriesSkeleton() {
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

// Server-side rendered accessories list page
export default async function AccessoriesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '100', 10)
  
  const startTime = performance.now()

  // Fetch accessories data with pagination
  const { accessories, totalCount, totalPages, currentPage } = await getAccessoriesWithPagination(page, limit)

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Accessories Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<AccessoriesSkeleton />}>
      <AccessoriesListClient 
        initialAccessories={accessories}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        pageSize={limit}
      />
    </Suspense>
  )
}
