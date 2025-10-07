import React, { Suspense } from 'react'
import { getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners } from '@/lib/supabase-server'
import AccessoryFormClient from '../AccessoryFormClient'

// Loading skeleton component
function AccessoryFormSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Server-side rendered new accessory page
export default async function NewAccessoryPage() {
  const startTime = performance.now()

  // Fetch all required data on the server
  const [vatRates, currencies, units, partners] = await Promise.all([
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] New Accessory Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<AccessoryFormSkeleton />}>
      <AccessoryFormClient 
        vatRates={vatRates}
        currencies={currencies}
        units={units}
        partners={partners}
      />
    </Suspense>
  )
}
