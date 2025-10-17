import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrencyById } from '@/lib/supabase-server'
import CurrenciesEditClient from './CurrenciesEditClient'

interface Currency {
  id: string
  name: string
  rate: number
  created_at: string
  updated_at: string
}

interface CurrenciesEditPageProps {
  params: Promise<{ id: string }>
}

// Server-side rendered currencies edit page
export default async function CurrenciesEditPage({ params }: CurrenciesEditPageProps) {
  const resolvedParams = await params
  const currency = await getCurrencyById(resolvedParams.id)
  
  if (!currency) {
    notFound()
  }
  
  return <CurrenciesEditClient initialCurrency={currency} />
}
