import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getStockMovementsWithPagination } from '@/lib/supabase-server'
import WarehouseOperationsClient from './WarehouseOperationsClient'

export const metadata: Metadata = {
  title: 'Műveletek'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
    movement_type?: string
    source_type?: string
  }>
}

function WarehouseOperationsSkeleton() {
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

export default async function WarehouseOperationsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const startTime = performance.now()
  
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const movementType = resolvedParams.movement_type || 'all'
  const sourceType = resolvedParams.source_type || 'all'
  
  const stockMovementsData = await getStockMovementsWithPagination(page, limit, searchTerm, movementType, sourceType)
  
  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Warehouse Operations Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  return (
    <Suspense fallback={<WarehouseOperationsSkeleton />}>
      <WarehouseOperationsClient 
        initialStockMovements={stockMovementsData.stockMovements}
        totalCount={stockMovementsData.totalCount}
        totalPages={stockMovementsData.totalPages}
        currentPage={stockMovementsData.currentPage}
        initialSearchTerm={searchTerm}
        initialMovementType={movementType}
        initialSourceType={sourceType}
        initialPageSize={limit}
      />
    </Suspense>
  )
}

