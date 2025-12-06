import React from 'react'
import type { Metadata } from 'next'
import { getCustomerOrdersWithPagination } from '@/lib/supabase-server'
import FulfillmentOrdersClient from './FulfillmentOrdersClient'

export const metadata: Metadata = {
  title: 'Ügyfél rendelések'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
    status?: string
  }>
}

export default async function FulfillmentOrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const statusFilter = resolvedParams.status || ''
  
  const ordersData = await getCustomerOrdersWithPagination(page, limit, searchTerm, statusFilter)
  
  return (
    <FulfillmentOrdersClient 
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

