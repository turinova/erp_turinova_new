import React from 'react'
import { getAllBrandsForEdgeMaterials, getAllVatRatesForEdgeMaterials } from '@/lib/supabase-server'
import NewEdgeMaterialClient from './NewEdgeMaterialClient'

interface Brand {
  id: string
  name: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

// Server-side rendered new edge material page
export default async function NewEdgeMaterialPage() {
  const brands = await getAllBrandsForEdgeMaterials()
  const vatRates = await getAllVatRatesForEdgeMaterials()
  
  // Find 27% VAT as default
  const vat27 = vatRates.find(v => v.kulcs === 27)
  const defaultVatId = vat27 ? vat27.id : (vatRates.length > 0 ? vatRates[0].id : '')

  return (
    <NewEdgeMaterialClient 
      brands={brands} 
      vatRates={vatRates} 
      defaultVatId={defaultVatId}
    />
  )
}
