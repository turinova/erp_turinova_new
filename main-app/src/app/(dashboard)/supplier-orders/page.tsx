import React from 'react'
import type { Metadata } from 'next'
import { getAllShopOrderItems, getAllPartners } from '@/lib/supabase-server'
import SupplierOrdersClient from './SupplierOrdersClient'

export const metadata: Metadata = {
  title: 'Beszállítói várólista'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
    status?: string
    partner_id?: string
  }>
}

export default async function SupplierOrdersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const search = resolvedParams.search || ''
  // All filtering now handled client-side like customer orders page

  console.log(`[SSR] Fetching supplier orders page ${page}, limit ${limit}, search: "${search}"`)

  const [itemsData, partners] = await Promise.all([
    getAllShopOrderItems(1, 99999, '', '', ''), // Fetch all items for client-side filtering
    getAllPartners()
  ])

  console.log(`[SSR] Supplier orders fetched successfully: ${itemsData.items.length} items, total: ${itemsData.totalCount}`)

  return (
    <SupplierOrdersClient 
      initialItems={itemsData.items}
      initialTotalCount={itemsData.totalCount}
      initialTotalPages={itemsData.totalPages}
      initialCurrentPage={itemsData.currentPage}
      initialLimit={itemsData.limit}
      initialSearch={search}
      initialStatus="open"
      initialPartnerId=""
      partners={partners}
    />
  )
}
