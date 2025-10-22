import React from 'react'
import { getAllWorkers, getAllCustomers, getAllAccessories, getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners } from '@/lib/supabase-server'
import ShopOrderClient from './ShopOrderClient'

// Server-side rendered shop order page
export default async function ShopOrderPage() {
  const startTime = performance.now()

  // Fetch all required data in parallel
  const [workers, customers, accessories, vatRates, currencies, units, partners] = await Promise.all([
    getAllWorkers(),
    getAllCustomers(),
    getAllAccessories(),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Shop Order Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  return (
    <ShopOrderClient 
      workers={workers}
      customers={customers}
      accessories={accessories}
      vatRates={vatRates}
      currencies={currencies}
      units={units}
      partners={partners}
    />
  )
}
