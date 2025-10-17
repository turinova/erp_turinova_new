import React from 'react'
import { getAllVatRatesForPartners, getAllCurrenciesForPartners } from '@/lib/supabase-server'
import PartnerNewClient from './PartnerNewClient'

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

interface Currency {
  id: string
  name: string
  rate: number
  created_at: string
  updated_at: string
}

// Server-side rendered new partner page
export default async function PartnerNewPage() {
  const vatRates = await getAllVatRatesForPartners()
  const currencies = await getAllCurrenciesForPartners()

  return <PartnerNewClient allVatRates={vatRates} allCurrencies={currencies} />
}
