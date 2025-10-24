import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllFeeTypes } from '@/lib/supabase-server'
import FeeTypesListClient from './FeeTypesListClient'

export const metadata: Metadata = {
  title: 'Díjtípusok'
}

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_id: string
  currency_id: string
  created_at: string
  updated_at: string
  vat_name: string
  vat_percent: number
  currency_name: string
  vat_amount: number
  gross_price: number
}

// Loading skeleton component
function FeeTypesSkeleton() {
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

// Server-side rendered fee types list page
export default async function FeeTypesPage() {
  const startTime = performance.now()

  // Fetch fee types data on the server
  const feeTypes = await getAllFeeTypes()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Fee Types Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<FeeTypesSkeleton />}>
      <FeeTypesListClient initialFeeTypes={feeTypes} />
    </Suspense>
  )
}
