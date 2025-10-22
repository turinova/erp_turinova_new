import React from 'react'
import { getQuotesWithPagination } from '@/lib/supabase-server'
import QuotesClient from './QuotesClient'

interface PageProps {
  searchParams: Promise<{ 
    page?: string
    search?: string
  }>
}

export default async function QuotesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const searchTerm = resolvedParams.search || ''
  
  // Fetch quotes with pagination and search
  const quotesData = await getQuotesWithPagination(page, 20, searchTerm)
  
  return (
    <QuotesClient 
      initialQuotes={quotesData.quotes}
      totalCount={quotesData.totalCount}
      totalPages={quotesData.totalPages}
      currentPage={quotesData.currentPage}
      initialSearchTerm={searchTerm}
    />
  )
}
