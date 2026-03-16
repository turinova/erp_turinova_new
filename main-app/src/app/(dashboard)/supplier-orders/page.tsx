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

  const page = Math.max(1, parseInt(resolvedParams.page || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(resolvedParams.limit || '50', 10)))
  const search = (resolvedParams.search || '').trim()
  const statusParam = resolvedParams.status ?? 'open'
  const status = statusParam === 'all' ? '' : statusParam // '' = no filter for getAllShopOrderItems
  const partnerId = resolvedParams.partner_id || ''

  const [itemsData, partners] = await Promise.all([
    getAllShopOrderItems(page, limit, search, status, partnerId),
    getAllPartners()
  ])

  return (
    <SupplierOrdersClient
      initialItems={itemsData.items}
      initialTotalCount={itemsData.totalCount}
      initialTotalPages={itemsData.totalPages}
      initialCurrentPage={itemsData.currentPage}
      initialLimit={itemsData.limit}
      initialSearch={search}
      initialStatus={statusParam}
      initialPartnerId={partnerId}
      partners={partners}
    />
  )
}
