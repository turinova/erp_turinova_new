import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getCustomerOrderById, getAllCustomers, getAllVatRates, getAllCurrencies, getAllUnits, getAllWorkers, getAllFeeTypes, getAllPartners } from '@/lib/supabase-server'
import FulfillmentOrderDetailClient from './FulfillmentOrderDetailClient'

function FulfillmentOrderDetailSkeleton() {
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
  const customerOrderData = await getCustomerOrderById(id)
  
  return {
    title: customerOrderData ? `Ügyfél rendelés - ${customerOrderData.order.order_number}` : 'Ügyfél rendelés'
  }
}

export default async function FulfillmentOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const startTime = performance.now()

  // Fetch all required data on the server
  const [customerOrderData, customers, vatRates, currencies, units, workers, feeTypes, partners] = await Promise.all([
    getCustomerOrderById(id),
    getAllCustomers(),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllWorkers(),
    getAllFeeTypes(),
    getAllPartners()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Customer Order Detail Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  if (!customerOrderData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Ügyfél rendelés nem található</h2>
          <p className="text-red-600">A keresett ügyfél rendelés nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<FulfillmentOrderDetailSkeleton />}>
      <FulfillmentOrderDetailClient 
        id={id}
        initialOrder={customerOrderData.order}
        initialItems={customerOrderData.items}
        initialPayments={customerOrderData.payments}
        initialTotalPaid={customerOrderData.total_paid}
        initialBalance={customerOrderData.balance}
        initialCustomers={customers}
        initialVatRates={vatRates}
        initialCurrencies={currencies}
        initialUnits={units}
        initialWorkers={workers}
        initialFeeTypes={feeTypes}
        initialPartners={partners}
      />
    </Suspense>
  )
}

