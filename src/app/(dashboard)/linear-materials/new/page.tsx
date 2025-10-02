import React from 'react'
import { getAllBrandsForLinearMaterials, getAllVatRatesForLinearMaterials, getAllCurrenciesForLinearMaterials } from '@/lib/supabase-server'
import NewLinearMaterialClient from './NewLinearMaterialClient'

export default async function NewLinearMaterialPage() {
  const brands = await getAllBrandsForLinearMaterials()
  const vatRates = await getAllVatRatesForLinearMaterials()
  const currencies = await getAllCurrenciesForLinearMaterials()
  
  // Find defaults
  const hufCurrency = currencies.find(c => c.name === 'HUF')
  const vat27 = vatRates.find(v => v.kulcs === 27)
  
  return (
    <NewLinearMaterialClient 
      brands={brands}
      vatRates={vatRates}
      currencies={currencies}
      defaultCurrencyId={hufCurrency?.id || ''}
      defaultVatId={vat27?.id || ''}
    />
  )
}

