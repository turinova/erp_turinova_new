import React from 'react'
import { getOrdersWithPagination } from '@/lib/supabase-server'
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
  
  // Fetch orders with pagination and search
  const ordersData = await getOrdersWithPagination(page, 20, searchTerm)
  
  return (
    <OrdersListClient 
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      totalPages={ordersData.totalPages}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
    />
  )
}

