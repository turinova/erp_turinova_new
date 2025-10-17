import React, { Suspense } from 'react'
import { getAllBrands } from '@/lib/supabase-server'
import BrandsListClient from './BrandsListClient'

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

// Loading skeleton component
function BrandsSkeleton() {
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

// Server-side rendered brands list page
export default async function GyartokPage() {
  const startTime = performance.now()
  
  // Fetch brands data on the server
  const brands = await getAllBrands()
  
  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Brands Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }
  
  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<BrandsSkeleton />}>
      <BrandsListClient initialBrands={brands} />
    </Suspense>
  )
}