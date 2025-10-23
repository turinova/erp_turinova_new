import React from 'react'
import { getPortalQuoteById } from '@/lib/supabase-server'
import { getCompanyInfo, getCompanyPaymentMethods } from '@/lib/company-data-server'
import PortalQuoteDetailClient from './PortalQuoteDetailClient'

interface PageProps {
  params: Promise<{ quote_id: string }>
}

export const metadata = {
  title: 'Árajánlat részletek - Turinova Ügyfélportál',
  description: 'Mentett árajánlat megtekintése'
}

export default async function PortalQuoteDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const quoteId = resolvedParams.quote_id
  
  console.log(`[Customer Portal] Loading portal quote detail: ${quoteId}`)
  
  // Fetch portal quote data
  const quoteData = await getPortalQuoteById(quoteId)
  
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
  
  // Fetch company information and payment methods from the target company's database
  let companyInfo = null
  let companyPaymentMethods: any[] = []
  
  if (quoteData.companies) {
    try {
      const [info, paymentMethods] = await Promise.all([
        getCompanyInfo({
          supabase_url: quoteData.companies.supabase_url,
          supabase_anon_key: quoteData.companies.supabase_anon_key
        }),
        getCompanyPaymentMethods({
          supabase_url: quoteData.companies.supabase_url,
          supabase_anon_key: quoteData.companies.supabase_anon_key
        })
      ])
      
      companyInfo = info
      companyPaymentMethods = paymentMethods
      
      console.log(`[Customer Portal] Fetched ${companyPaymentMethods.length} active payment methods for company`)
    } catch (error) {
      console.error('[Customer Portal] Error fetching company data:', error)
    }
  }
  
  console.log(`[Customer Portal] Quote loaded: ${quoteData.quote_number}`)
  
  return (
    <PortalQuoteDetailClient 
      initialQuoteData={quoteData}
      companyInfo={companyInfo}
      companyPaymentMethods={companyPaymentMethods}
    />
  )
}

