import React from 'react'
import type { Metadata } from 'next'
import { 
  getAllBrandsForMaterials,
  getAllCurrencies,
  getAllVatRates,
  getAllPartners,
  getAllUnits
} from '@/lib/supabase-server'
import NewMaterialClient from './NewMaterialClient'

export const metadata: Metadata = {
  title: 'Új táblás anyag'
}

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
