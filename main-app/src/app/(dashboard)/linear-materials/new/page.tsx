import React from 'react'
import type { Metadata } from 'next'
import { getAllBrandsForLinearMaterials, getAllVatRatesForLinearMaterials, getAllCurrenciesForLinearMaterials, getAllPartners, getAllUnits } from '@/lib/supabase-server'
import NewLinearMaterialClient from './NewLinearMaterialClient'

export const metadata: Metadata = {
  title: 'Új szálas anyag'
}

export default async function NewLinearMaterialPage() {
  const brands = await getAllBrandsForLinearMaterials()
  const vatRates = await getAllVatRatesForLinearMaterials()
  const currencies = await getAllCurrenciesForLinearMaterials()
  const partners = await getAllPartners()
  const units = await getAllUnits()
  
  // Find defaults
  const hufCurrency = currencies.find(c => c.name === 'HUF')
  const vat27 = vatRates.find(v => v.kulcs === 27)
  const defaultUnit = units.find(u => u.shortform === 'm') || units[0]
  
  return (
    <NewLinearMaterialClient 
      brands={brands}
      vatRates={vatRates}
      currencies={currencies}
      partners={partners}
      units={units}
      defaultCurrencyId={hufCurrency?.id || ''}
      defaultVatId={vat27?.id || ''}
      defaultUnitId={defaultUnit?.id || ''}
    />
  )
}

