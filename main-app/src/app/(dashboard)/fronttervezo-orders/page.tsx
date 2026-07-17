import type { Metadata } from 'next'

import { getFronttervezoOrdersWithPagination } from '@/lib/supabase-server'

import FronttervezoOrdersClient from './FronttervezoOrdersClient'

export const metadata: Metadata = {
  title: 'Front megrendelések'
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
    status?: string
  }>
}

export default async function FronttervezoOrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const statusFilter = resolvedParams.status || 'ordered'

  const ordersData = await getFronttervezoOrdersWithPagination(
    page,
    limit,
    searchTerm,
    statusFilter
  )

  return (
    <FronttervezoOrdersClient
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      totalPages={ordersData.totalPages}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
      initialStatusFilter={statusFilter}
      initialPageSize={limit}
    />
  )
}
