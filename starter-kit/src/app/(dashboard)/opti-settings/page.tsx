import React, { Suspense } from 'react'
import { getCuttingFee, getAllCurrencies, getAllVatRates } from '@/lib/supabase-server'
import OptiSettingsClient from './OptiSettingsClient'

interface Currency {
  id: string
  name: string
}

interface VatRate {
  id: string
  kulcs: number
}

interface CuttingFee {
  id: string
  fee_per_meter: number
  panthelyfuras_fee_per_hole: number
  duplungolas_fee_per_sqm: number
  szogvagas_fee_per_panel: number
  currency_id: string
  vat_id: string
  currencies: Currency
  vat: VatRate
  created_at: string
  updated_at: string
}

// Loading skeleton component
function OptiSettingsSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Server-side rendered opti settings page
export default async function OptiSettingsPage() {
  const startTime = performance.now()

  // Fetch all required data in parallel for optimal SSR performance
  const [cuttingFee, currencies, vatRates] = await Promise.all([
    getCuttingFee(),
    getAllCurrencies(),
    getAllVatRates()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Opti Settings Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<OptiSettingsSkeleton />}>
      <OptiSettingsClient 
        initialCuttingFee={cuttingFee} 
        currencies={currencies || []} 
        vatRates={vatRates || []} 
      />
    </Suspense>
  )
}
