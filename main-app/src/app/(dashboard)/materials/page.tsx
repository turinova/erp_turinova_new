import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllMaterials } from '@/lib/supabase-server'
import MaterialsListClient from './MaterialsListClient'

export const metadata: Metadata = {
  title: 'Táblás anyagok'
}

interface Material {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
  image_url: string | null
  brand_id: string
  brand_name: string
  kerf_mm: number
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  rotatable: boolean
  waste_multi: number
  machine_code: string
  price_per_sqm: number
  vat_percent: number
  created_at: string
  updated_at: string
}

// Loading skeleton component
function MaterialsSkeleton() {
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

// Server-side rendered materials list page
export default async function MaterialsPage() {
  const startTime = performance.now()
  
  // Fetch all materials data for client-side filtering and pagination
  const materials = await getAllMaterials()
  
  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Materials Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<MaterialsSkeleton />}>
      <MaterialsListClient 
        initialMaterials={materials}
        totalCount={materials.length}
        totalPages={Math.ceil(materials.length / 50)}
        currentPage={1}
        pageSize={50}
      />
    </Suspense>
  )
}
