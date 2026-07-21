import React from 'react'
import { getUnifiedSavedQuotes } from '@/lib/supabase-server'
import SavedQuotesClient from './SavedQuotesClient'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export const metadata = {
  title: 'Mentések - Turinova Ügyfélportál',
  description: 'Mentett árajánlataim'
}

export default async function SavedQuotesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const searchTerm = resolvedParams.search || ''

  const quotesData = await getUnifiedSavedQuotes(page, 20, searchTerm)

  return (
    <SavedQuotesClient
      initialQuotes={quotesData.quotes}
      totalCount={quotesData.totalCount}
      totalPages={quotesData.totalPages}
      currentPage={quotesData.currentPage}
      initialSearchTerm={searchTerm}
    />
  )
}
