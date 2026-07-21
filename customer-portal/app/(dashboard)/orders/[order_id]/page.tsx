import React from 'react'
import { getPortalQuoteById } from '@/lib/supabase-server'
import { getCompanyInfo, getCompanyPaymentMethods } from '@/lib/company-data-server'
import PortalQuoteDetailClient from '../../saved/[quote_id]/PortalQuoteDetailClient'

interface PageProps {
  params: Promise<{ order_id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const quoteId = resolvedParams.order_id

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

  let companyInfo = null
  let companyPaymentMethods: any[] = []

  if (portalQuote.companies) {
    try {
      const [info, paymentMethods] = await Promise.all([
        getCompanyInfo({
          supabase_url: portalQuote.companies.supabase_url,
          supabase_anon_key: portalQuote.companies.supabase_anon_key
        }),
        getCompanyPaymentMethods({
          supabase_url: portalQuote.companies.supabase_url,
          supabase_anon_key: portalQuote.companies.supabase_anon_key
        })
      ])
      companyInfo = info
      companyPaymentMethods = paymentMethods
    } catch (error) {
      console.error('[Order Detail] Failed to fetch company info:', error)
    }
  }

  return (
    <PortalQuoteDetailClient
      initialQuoteData={portalQuote}
      companyInfo={companyInfo}
      companyPaymentMethods={companyPaymentMethods}
    />
  )
}
