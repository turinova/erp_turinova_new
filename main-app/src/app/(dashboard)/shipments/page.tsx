import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getShipmentsWithPagination } from '@/lib/supabase-server'
import ShipmentsListClient from './ShipmentsListClient'

export const metadata: Metadata = {
  title: 'Szállítmányok'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
    status?: string
  }>
}

function ShipmentsSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function ShipmentsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const startTime = performance.now()
  
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const statusFilter = resolvedParams.status || 'all'
  
  const shipmentsData = await getShipmentsWithPagination(page, limit, searchTerm, statusFilter)
  
  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Shipments Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  return (
    <Suspense fallback={<ShipmentsSkeleton />}>
      <ShipmentsListClient 
        initialShipments={shipmentsData.shipments}
        totalCount={shipmentsData.totalCount}
        totalPages={shipmentsData.totalPages}
        currentPage={shipmentsData.currentPage}
        initialSearchTerm={searchTerm}
        initialStatusFilter={statusFilter}
        initialPageSize={limit}
      />
    </Suspense>
  )
}


