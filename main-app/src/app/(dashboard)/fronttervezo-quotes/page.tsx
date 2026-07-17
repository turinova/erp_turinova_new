import React from 'react'
import type { Metadata } from 'next'

import { getFronttervezoQuotesWithPagination } from '@/lib/supabase-server'

import FronttervezoQuotesClient from './FronttervezoQuotesClient'

export const metadata: Metadata = {
  title: 'Front ajánlatok'
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function FronttervezoQuotesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const searchTerm = resolvedParams.search || ''
  const safePage = Number.isFinite(page) && page > 0 ? page : 1

  const quotesData = await getFronttervezoQuotesWithPagination(safePage, 20, searchTerm)

  return (
    <FronttervezoQuotesClient
      initialQuotes={quotesData.quotes}
      totalCount={quotesData.totalCount}
      totalPages={quotesData.totalPages || 1}
      currentPage={quotesData.currentPage}
      initialSearchTerm={searchTerm}
    />
  )
}
