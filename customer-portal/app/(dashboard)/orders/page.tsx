import React from 'react'
import { getPortalOrdersWithPagination } from '@/lib/supabase-server'
import OrdersClient from './OrdersClient'

interface PageProps {
  searchParams: Promise<{ 
    page?: string
    search?: string
  }>
}

export const metadata = {
  title: 'Megrendelések - Turinova Ügyfélportál',
  description: 'Elküldött árajánlataim'
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1')
  const searchTerm = resolvedParams.search || ''
  
  // Fetch submitted portal quotes (orders) with company quote info
  const ordersData = await getPortalOrdersWithPagination(page, 20, searchTerm)
  
  return (
    <OrdersClient 
      initialOrders={ordersData.orders}
      totalCount={ordersData.totalCount}
      totalPages={ordersData.totalPages}
      currentPage={ordersData.currentPage}
      initialSearchTerm={searchTerm}
    />
  )
}
