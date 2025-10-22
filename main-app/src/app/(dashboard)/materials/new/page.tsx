import React from 'react'
import { 
  getAllBrandsForMaterials,
  getAllCurrencies,
  getAllVatRates,
  getAllPartners,
  getAllUnits
} from '@/lib/supabase-server'
import NewMaterialClient from './NewMaterialClient'

// Server-side rendered new material page
export default async function NewMaterialPage() {
  // Fetch all data on the server for SSR (prevents hydration issues)
  const [brands, currencies, vatRates, partners, units] = await Promise.all([
    getAllBrandsForMaterials(),
    getAllCurrencies(),
    getAllVatRates(),
    getAllPartners(),
    getAllUnits()
  ])

  // Pass pre-loaded data to client component
  return (
    <NewMaterialClient 
      initialBrands={brands}
      initialCurrencies={currencies}
      initialVatRates={vatRates}
      initialPartners={partners}
      initialUnits={units}
    />
  )
}
