import React from 'react'
import type { Metadata } from 'next'
import { 
  getQuoteById, 
  getAllFeeTypes, 
  getAllVatRates,
  getAllCurrencies,
  getAllUnits,
  getAllPartners,
  getAllProductionMachines,
  getQuoteEdgeMaterialsBreakdown
} from '@/lib/supabase-server'
import QuoteDetailClient from './QuoteDetailClient'

interface PageProps {
  params: Promise<{ quote_id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const quoteData = await getQuoteById(resolvedParams.quote_id)
  
  return {
    title: quoteData ? `Ajánlat - ${quoteData.quote_number}` : 'Ajánlat'
  }
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const quoteId = resolvedParams.quote_id
  
  // Fetch all data in parallel for SSR (optimized - removed getAllAccessories as it's not used)
  const [quoteData, feeTypes, vatRates, currencies, units, partners, machines, edgeMaterialsBreakdown] = await Promise.all([
    getQuoteById(quoteId),
    getAllFeeTypes(),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners(),
    getAllProductionMachines(),
    getQuoteEdgeMaterialsBreakdown(quoteId)
  ])
  
  if (!quoteData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Árajánlat nem található</h1>
          <p className="text-gray-600">A keresett árajánlat nem létezik vagy nincs hozzáférésed hozzá.</p>
        </div>
      </div>
    )
  }
  
  return (
    <QuoteDetailClient 
      initialQuoteData={quoteData}
      feeTypes={feeTypes}
      vatRates={vatRates}
      currencies={currencies}
      units={units}
      partners={partners}
      machines={machines}
      edgeMaterialsBreakdown={edgeMaterialsBreakdown}
    />
  )
}
