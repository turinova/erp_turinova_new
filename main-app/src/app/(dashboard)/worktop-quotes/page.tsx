import React from 'react'
import type { Metadata } from 'next'
import { getWorktopQuotesWithPagination } from '@/lib/supabase-server'
import WorktopQuotesClient from './WorktopQuotesClient'

export const metadata: Metadata = {
  title: 'Munkalap ajánlatok'
}

// Force dynamic rendering to prevent caching issues with pagination
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ 
    page?: string
    search?: string
  }>
}

export default async function WorktopQuotesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const searchTerm = resolvedParams.search || ''
  
  // Fetch worktop quotes with pagination and search
  const quotesData = await getWorktopQuotesWithPagination(page, 20, searchTerm)
  
  return (
    <WorktopQuotesClient 
      initialQuotes={quotesData.quotes}
      totalCount={quotesData.totalCount}
      totalPages={quotesData.totalPages}
      currentPage={quotesData.currentPage}
      initialSearchTerm={searchTerm}
    />
  )
}
