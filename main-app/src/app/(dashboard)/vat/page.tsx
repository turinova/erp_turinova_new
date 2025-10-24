import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllVatRates } from '@/lib/supabase-server'
import VATListClient from './VATListClient'

export const metadata: Metadata = {
  title: 'Adónem'
}

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

// Loading skeleton component
function VATSkeleton() {
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

// Server-side rendered VAT list page
export default async function VatPage() {
  const startTime = performance.now()

  // Fetch VAT rates data on the server
  const vatRates = await getAllVatRates()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] VAT Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<VATSkeleton />}>
      <VATListClient initialVatRates={vatRates} />
    </Suspense>
  )
}
