import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getPurchaseOrderById, getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners, getAllWarehouses } from '@/lib/supabase-server'
import PurchaseOrderFormClient from '../purchase/PurchaseOrderFormClient'

function PurchaseOrderFormSkeleton() {
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
  const po = await getPurchaseOrderById(id)
  
  return {
    title: po ? `Beszállítói rendelés - ${po.header.po_number}` : 'Beszállítói rendelés'
  }
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const startTime = performance.now()

  // Fetch all required data on the server
  const [poData, vatRates, currencies, units, partners, warehouses] = await Promise.all([
    getPurchaseOrderById(id),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners(),
    getAllWarehouses()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Purchase Order Detail Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  if (!poData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Beszállítói rendelés nem található</h2>
          <p className="text-red-600">A keresett beszállítói rendelés nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<PurchaseOrderFormSkeleton />}>
      <PurchaseOrderFormClient 
        mode="edit" 
        id={id}
        initialHeader={poData.header}
        initialItems={poData.items}
        initialVatRates={vatRates}
        initialCurrencies={currencies}
        initialUnits={units}
        initialPartners={partners}
        initialWarehouses={warehouses}
      />
    </Suspense>
  )
}


