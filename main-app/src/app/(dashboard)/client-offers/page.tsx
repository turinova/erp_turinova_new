import React from 'react'
import type { Metadata } from 'next'
import { getClientOffersWithPagination } from '@/lib/supabase-server'
import ClientOffersClient from './ClientOffersClient'

export const metadata: Metadata = {
  title: 'Ügyfél ajánlatok'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
    status?: string
  }>
}

export default async function ClientOffersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const statusFilter = resolvedParams.status || ''
  
  const offersData = await getClientOffersWithPagination(page, limit, searchTerm, statusFilter)
  
  return (
    <ClientOffersClient 
      initialOffers={offersData.offers}
      totalCount={offersData.totalCount}
      totalPages={offersData.totalPages}
      currentPage={offersData.currentPage}
      initialSearchTerm={searchTerm}
      initialStatusFilter={statusFilter}
      initialPageSize={limit}
      statusCounts={offersData.statusCounts}
    />
  )
}

