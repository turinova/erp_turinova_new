import React from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getAllFeeTypes, getFronttervezoQuoteById } from '@/lib/supabase-server'

import FronttervezoQuoteDetailClient from './FronttervezoQuoteDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const quote = await getFronttervezoQuoteById(id)

  return {
    title: quote ? `Front ajánlat - ${quote.quote_number}` : 'Front ajánlat'
  }
}

export const dynamic = 'force-dynamic'

export default async function FronttervezoQuoteDetailPage({ params }: PageProps) {
  const { id } = await params

  const [quoteData, feeTypes] = await Promise.all([
    getFronttervezoQuoteById(id),
    getAllFeeTypes()
  ])

  if (!quoteData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Árajánlat nem található</h1>
          <p className="text-gray-600">
            A keresett front ajánlat nem létezik vagy nincs hozzáférésed hozzá.
          </p>
        </div>
      </div>
    )
  }

  if (quoteData.status !== 'draft') {
    redirect(`/fronttervezo-orders/${id}`)
  }

  return (
    <FronttervezoQuoteDetailClient
      initialQuoteData={quoteData as Parameters<typeof FronttervezoQuoteDetailClient>[0]['initialQuoteData']}
      feeTypes={feeTypes as never[]}
    />
  )
}
