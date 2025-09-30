import React from 'react'
import { notFound } from 'next/navigation'
import { getPartnerById, getAllVatRatesForPartners, getAllCurrenciesForPartners } from '@/lib/supabase-server'
import PartnerEditClient from './PartnerEditClient'

interface Partner {
  id: string
  name: string
  country: string
  postal_code: string
  city: string
  address: string
  mobile: string
  email: string
  tax_number: string
  company_registration_number: string
  bank_account: string
  notes: string
  status: string
  contact_person: string
  vat_id: string
  currency_id: string
  payment_terms: number
  created_at: string
  updated_at: string
  vat: {
    name: string
    kulcs: number
  }
  currencies: {
    name: string
    rate: number
  }
}

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

interface PartnerEditPageProps {
  params: Promise<{ id: string }>
}

// Server-side rendered partner edit page
export default async function PartnerEditPage({ params }: PartnerEditPageProps) {
  const resolvedParams = await params
  const partner = await getPartnerById(resolvedParams.id)
  const vatRates = await getAllVatRatesForPartners()
  const currencies = await getAllCurrenciesForPartners()

  if (!partner) {
    notFound()
  }

  return <PartnerEditClient initialPartner={partner} allVatRates={vatRates} allCurrencies={currencies} />
}
