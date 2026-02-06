import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getWorktopConfigFees, getAllCurrencies, getAllVatRates } from '@/lib/supabase-server'
import MunkiSettingsClient from './MunkiSettingsClient'

export const metadata: Metadata = {
  title: 'Munki beállítások'
}

interface Currency {
  id: string
  name: string
}

interface VatRate {
  id: string
  kulcs: number
}

interface WorktopConfigFee {
  id: string
  kereszt_vagas_fee: number
  hosszanti_vagas_fee_per_meter: number
  ives_vagas_fee: number
  szogvagas_fee: number
  kivagas_fee: number
  elzaro_fee_per_meter: number
  osszemaras_fee: number
  currency_id: string
  vat_id: string
  currencies: Currency
  vat: VatRate
  created_at: string
  updated_at: string
}

// Loading skeleton component
function MunkiSettingsSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Server-side rendered munki settings page
export default async function MunkiSettingsPage() {
  const startTime = performance.now()

  // Fetch all required data in parallel for optimal SSR performance
  const [worktopConfigFee, currencies, vatRates] = await Promise.all([
    getWorktopConfigFees(),
    getAllCurrencies(),
    getAllVatRates()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Munki Settings Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<MunkiSettingsSkeleton />}>
      <MunkiSettingsClient 
        initialWorktopConfigFee={worktopConfigFee} 
        currencies={currencies || []} 
        vatRates={vatRates || []} 
      />
    </Suspense>
  )
}
