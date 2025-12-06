import React from 'react'
import type { Metadata } from 'next'
import { getAllCustomerOrderItems, getAllPartners } from '@/lib/supabase-server'
import CustomerOrderItemsClient from './CustomerOrderItemsClient'

export const metadata: Metadata = {
  title: 'Ügyfél rendelés tételek'
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

export default async function CustomerOrderItemsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const search = resolvedParams.search || ''
  // All filtering now handled client-side

  console.log(`[SSR] Fetching customer order items page ${page}, limit ${limit}, search: "${search}"`)

  // Fetch all items (both active and deleted) for client-side filtering
  // We'll fetch with empty status to get all, then filter client-side
  const [itemsData, partners] = await Promise.all([
    getAllCustomerOrderItems(1, 99999, '', '', ''), // Fetch all active items
    getAllPartners()
  ])
  
  // Also fetch deleted items separately
  const [deletedItemsData] = await Promise.all([
    getAllCustomerOrderItems(1, 99999, '', 'deleted', '') // Fetch deleted items
  ])
  
  // Combine items
  const allItemsData = {
    ...itemsData,
    items: [...itemsData.items, ...(deletedItemsData.items || [])],
    totalCount: itemsData.totalCount + deletedItemsData.totalCount
  }

  console.log(`[SSR] Customer order items fetched successfully: ${allItemsData.items.length} items, total: ${allItemsData.totalCount}`)

  return (
    <CustomerOrderItemsClient 
      initialItems={allItemsData.items}
      initialTotalCount={allItemsData.totalCount}
      initialTotalPages={allItemsData.totalPages}
      initialCurrentPage={allItemsData.currentPage}
      initialLimit={allItemsData.limit}
      initialSearch={search}
      initialStatus="open"
      initialPartnerId=""
      partners={partners}
    />
  )
}

