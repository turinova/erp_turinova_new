import React from 'react'
import { getPortalQuoteById } from '@/lib/supabase-server'
import { getCompanyInfo } from '@/lib/company-data-server'
import PortalQuoteDetailClient from '../../saved/[quote_id]/PortalQuoteDetailClient'

interface PageProps {
  params: Promise<{ order_id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const quoteId = resolvedParams.order_id

  // Fetch the portal quote
  const portalQuote = await getPortalQuoteById(quoteId)

  if (!portalQuote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Megrendelés nem található</h1>
          <p className="text-gray-600">A keresett megrendelés nem létezik vagy nincs hozzáférésed hozzá.</p>
        </div>
      </div>
    )
  }

  // Fetch company information
  let companyInfo = null
  if (portalQuote.target_company_id) {
    try {
      const credentials = {
        supabaseUrl: process.env.NEXT_PUBLIC_COMPANY_SUPABASE_URL || '',
        supabaseKey: process.env.NEXT_PUBLIC_COMPANY_SUPABASE_ANON_KEY || ''
      }
      companyInfo = await getCompanyInfo(credentials)
    } catch (error) {
      console.error('[Order Detail] Failed to fetch company info:', error)
    }
  }

  return (
    <PortalQuoteDetailClient 
      portalQuote={portalQuote}
      companyInfo={companyInfo}
    />
  )
}
