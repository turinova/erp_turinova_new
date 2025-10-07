import React from 'react'
import { getQuoteById } from '@/lib/supabase-server'
import QuoteDetailClient from './QuoteDetailClient'

interface PageProps {
  params: Promise<{ quote_id: string }>
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const quoteId = resolvedParams.quote_id
  
  // Fetch quote data
  const quoteData = await getQuoteById(quoteId)
  
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
    />
  )
}
