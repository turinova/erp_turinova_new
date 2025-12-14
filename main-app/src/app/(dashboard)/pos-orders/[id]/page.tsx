import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getPosOrderById, getAllCustomers, getAllVatRates, getAllCurrencies, getAllUnits, getAllWorkers, getAllFeeTypes, getTenantCompany } from '@/lib/supabase-server'
import PosOrderDetailClient from './PosOrderDetailClient'

function PosOrderDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const posOrderData = await getPosOrderById(id)
  
  return {
    title: posOrderData ? `POS rendelés - ${posOrderData.order.pos_order_number}` : 'POS rendelés'
  }
}

export default async function PosOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const startTime = performance.now()

  // Fetch all required data on the server
  const [posOrderData, customers, vatRates, currencies, units, workers, feeTypes, tenantCompany] = await Promise.all([
    getPosOrderById(id),
    getAllCustomers(),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllWorkers(),
    getAllFeeTypes(),
    getTenantCompany()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] POS Order Detail Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  if (!posOrderData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">POS rendelés nem található</h2>
          <p className="text-red-600">A keresett POS rendelés nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<PosOrderDetailSkeleton />}>
      <PosOrderDetailClient 
        id={id}
        initialOrder={posOrderData.order}
        initialItems={posOrderData.items}
        initialPayments={posOrderData.payments}
        initialTotalPaid={posOrderData.total_paid}
        initialBalance={posOrderData.balance}
        initialCustomers={customers}
        initialVatRates={vatRates}
        initialCurrencies={currencies}
        initialUnits={units}
        initialWorkers={workers}
        initialFeeTypes={feeTypes}
        initialTenantCompany={tenantCompany}
      />
    </Suspense>
  )
}

