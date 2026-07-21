import React from 'react'
import { createClient } from '@supabase/supabase-js'

import type { CompanyQuoteStatusMeta } from '@/components/portal-list/NettfrontStatusHistoryCard'
import { getCompanyInfo, getCompanyPaymentMethods } from '@/lib/company-data-server'
import { getPortalNettfrontQuoteById } from '@/lib/supabase-server'

import NettfrontQuoteDetailClient from './NettfrontQuoteDetailClient'

interface PageProps {
  params: Promise<{ quote_id: string }>
}

export const metadata = {
  title: 'Nettfront árajánlat - Turinova Ügyfélportál',
  description: 'Mentett Nettfront árajánlat'
}

async function loadCompanyQuoteMeta(
  supabaseUrl: string,
  anonKey: string,
  companyQuoteId: string
): Promise<CompanyQuoteStatusMeta> {
  try {
    const companySupabase = createClient(supabaseUrl, anonKey)
    const { data, error } = await companySupabase
      .from('fronttervezo_quotes')
      .select(
        `
        quote_number, order_number, status, payment_status, deleted_at,
        ordered_at, ready_at, finished_at, cancelled_at,
        payment_methods (id, name)
      `
      )
      .eq('id', companyQuoteId)
      .single()

    if (error || !data) {
      console.warn('[Nettfront Detail] company quote meta:', error?.message)
      return null
    }

    const pm = data.payment_methods as { name?: string } | { name?: string }[] | null
    const pmName = Array.isArray(pm) ? pm[0]?.name : pm?.name
    const isDeleted = Boolean(data.deleted_at)

    return {
      company_quote_number: data.order_number || data.quote_number || 'N/A',
      company_quote_status: isDeleted ? 'deleted' : data.status || 'unknown',
      company_payment_status: data.payment_status || null,
      company_payment_method: pmName || null,
      status_timestamps: {
        ordered_at: data.ordered_at ?? null,
        in_production_at: null,
        ready_at: data.ready_at ?? null,
        finished_at: data.finished_at ?? null,
        cancelled_at: data.cancelled_at ?? null
      }
    }
  } catch (e) {
    console.error('[Nettfront Detail] company quote meta failed:', e)
    return null
  }
}

export default async function NettfrontQuoteDetailPage({ params }: PageProps) {
  const { quote_id: quoteId } = await params
  const quoteData = await getPortalNettfrontQuoteById(quoteId)

  if (!quoteData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Árajánlat nem található</h1>
          <p className="text-gray-600">
            A keresett Nettfront árajánlat nem létezik vagy nincs hozzáférésed hozzá.
          </p>
        </div>
      </div>
    )
  }

  let companyInfo = null
  let companyPaymentMethods: { id: string; name: string; comment?: string | null }[] = []
  let companyQuoteMeta: CompanyQuoteStatusMeta = null

  if (quoteData.companies) {
    try {
      const creds = {
        supabase_url: quoteData.companies.supabase_url,
        supabase_anon_key: quoteData.companies.supabase_anon_key
      }
      const [info, paymentMethods, meta] = await Promise.all([
        getCompanyInfo(creds),
        getCompanyPaymentMethods(creds),
        quoteData.status === 'submitted' && quoteData.submitted_to_company_quote_id
          ? loadCompanyQuoteMeta(
              creds.supabase_url,
              creds.supabase_anon_key,
              quoteData.submitted_to_company_quote_id
            )
          : Promise.resolve(null)
      ])
      companyInfo = info
      companyPaymentMethods = paymentMethods || []
      companyQuoteMeta = meta
    } catch (error) {
      console.error('[Nettfront Detail] company data:', error)
    }
  }

  return (
    <NettfrontQuoteDetailClient
      initialQuoteData={quoteData as never}
      companyInfo={companyInfo}
      companyPaymentMethods={companyPaymentMethods}
      companyQuoteMeta={companyQuoteMeta}
    />
  )
}
