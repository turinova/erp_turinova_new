import React from 'react'
import { getOrdersWithPagination, getAllProductionMachines } from '@/lib/supabase-server'
import OrdersListClient from './OrdersListClient'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const searchTerm = resolvedParams.search || ''
  
  // Fetch orders and machines in parallel
  const [ordersData, machines] = await Promise.all([
    getOrdersWithPagination(page, 20, searchTerm),
    getAllProductionMachines()
  ])
  
  return (
    <OrdersListClient 
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      totalPages={ordersData.totalPages}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
      machines={machines}
    />
  )
}

