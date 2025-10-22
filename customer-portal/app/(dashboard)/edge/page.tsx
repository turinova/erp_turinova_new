import React, { Suspense } from 'react'
import { getAllEdgeMaterials } from '@/lib/supabase-server'
import EdgeMaterialsListClient from './EdgeMaterialsListClient'

interface EdgeMaterial {
  id: string
  brand_id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  vat_id: string
  created_at: string
  updated_at: string
  brands: {
    name: string
  }
  vat: {
    name: string
    kulcs: number
  }
}

// Loading skeleton component
function EdgeMaterialsSkeleton() {
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

// Server-side rendered edge materials list page
export default async function EdgeMaterialsPage() {
  const startTime = performance.now()

  // Fetch edge materials data on the server
  const edgeMaterials = await getAllEdgeMaterials()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Edge Materials Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<EdgeMaterialsSkeleton />}>
      <EdgeMaterialsListClient initialEdgeMaterials={edgeMaterials} />
    </Suspense>
  )
}