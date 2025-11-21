import React from 'react'
import type { Metadata } from 'next'
import { getOrdersWithPagination, getAllProductionMachines } from '@/lib/supabase-server'
import OrdersListClient from './OrdersListClient'

export const metadata: Metadata = {
  title: 'Megrendelések'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
    status?: string
  }>
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const statusFilter = resolvedParams.status || 'ordered'
  
  // Fetch orders and machines in parallel with proper server-side pagination
  const [ordersData, machines] = await Promise.all([
    getOrdersWithPagination(page, limit, searchTerm, statusFilter),
    getAllProductionMachines()
  ])
  
  return (
    <OrdersListClient 
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      totalPages={ordersData.totalPages}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
      initialStatusFilter={statusFilter}
      initialPageSize={limit}
      machines={machines}
    />
  )
}

