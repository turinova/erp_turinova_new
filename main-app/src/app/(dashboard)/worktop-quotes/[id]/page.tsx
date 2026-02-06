import React from 'react'
import type { Metadata } from 'next'
import { getWorktopQuoteById, getTenantCompany } from '@/lib/supabase-server'
import WorktopQuoteDetailClient from './WorktopQuoteDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const quoteData = await getWorktopQuoteById(resolvedParams.id)
  
  return {
    title: quoteData ? `Munkalap ajánlat - ${quoteData.quote_number}` : 'Munkalap ajánlat'
  }
}

export default async function WorktopQuoteDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const quoteId = resolvedParams.id
  
  // Fetch worktop quote data and tenant company in parallel
  const [quoteData, tenantCompany] = await Promise.all([
    getWorktopQuoteById(quoteId),
    getTenantCompany()
  ])
  
  if (!quoteData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Munkalap ajánlat nem található</h1>
          <p className="text-gray-600">A keresett munkalap ajánlat nem létezik vagy nincs hozzáférésed hozzá.</p>
        </div>
      </div>
    )
  }
  
  return (
    <WorktopQuoteDetailClient 
      initialQuoteData={quoteData}
      tenantCompany={tenantCompany}
    />
  )
}
