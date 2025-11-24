import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners, getAllWarehouses } from '@/lib/supabase-server'
import PurchaseOrderFormClient from '../purchase/PurchaseOrderFormClient'

export const metadata: Metadata = {
  title: 'Új beszállítói rendelés'
}

function PurchaseOrderFormSkeleton() {
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

export default async function NewPurchaseOrderPage() {
  const startTime = performance.now()

  // Fetch all required data on the server
  const [vatRates, currencies, units, partners, warehouses] = await Promise.all([
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners(),
    getAllWarehouses()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] New Purchase Order Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  return (
    <Suspense fallback={<PurchaseOrderFormSkeleton />}>
      <PurchaseOrderFormClient 
        mode="create"
        initialVatRates={vatRates}
        initialCurrencies={currencies}
        initialUnits={units}
        initialPartners={partners}
        initialWarehouses={warehouses}
      />
    </Suspense>
  )
}


