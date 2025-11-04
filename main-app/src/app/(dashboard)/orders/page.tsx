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
  }>
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const searchTerm = resolvedParams.search || ''
  
  // Fetch orders and machines in parallel
  // Note: Using large limit (1000) because client-side status filtering needs all orders
  const [ordersData, machines] = await Promise.all([
    getOrdersWithPagination(page, 1000, searchTerm),
    getAllProductionMachines()
  ])
  
  return (
    <OrdersListClient 
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
      machines={machines}
    />
  )
}

