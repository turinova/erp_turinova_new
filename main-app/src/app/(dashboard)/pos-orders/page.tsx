import React from 'react'
import type { Metadata } from 'next'
import { getPosOrdersWithPagination } from '@/lib/supabase-server'
import PosOrdersClient from './PosOrdersClient'

export const metadata: Metadata = {
  title: 'Rendelések'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
  }>
}

export default async function PosOrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  
  const ordersData = await getPosOrdersWithPagination(page, limit, searchTerm)
  
  return (
    <PosOrdersClient 
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      totalPages={ordersData.totalPages}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
      initialPageSize={limit}
    />
  )
}

