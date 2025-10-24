import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllCurrencies } from '@/lib/supabase-server'
import CurrenciesListClient from './CurrenciesListClient'

export const metadata: Metadata = {
  title: 'Pénznem'
}

interface Currency {
  id: string
  name: string
  rate: number
  created_at: string
  updated_at: string
}

// Loading skeleton component
function CurrenciesSkeleton() {
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

// Server-side rendered currencies list page
export default async function CurrenciesPage() {
  const startTime = performance.now()

  // Fetch currencies data on the server
  const currencies = await getAllCurrencies()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Currencies Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<CurrenciesSkeleton />}>
      <CurrenciesListClient initialCurrencies={currencies} />
    </Suspense>
  )
}
