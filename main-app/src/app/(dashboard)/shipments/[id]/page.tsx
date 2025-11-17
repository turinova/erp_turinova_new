import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getShipmentById, getAllVatRates } from '@/lib/supabase-server'
import ShipmentDetailClient from './ShipmentDetailClient'

function ShipmentDetailSkeleton() {
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
  const shipment = await getShipmentById(id)
  
  return {
    title: shipment ? `Szállítmány - ${shipment.header.po_number}` : 'Szállítmány'
  }
}

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const startTime = performance.now()

  // Fetch all required data on the server
  const [shipmentData, vatRates] = await Promise.all([
    getShipmentById(id),
    getAllVatRates()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Shipment Detail Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  if (!shipmentData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Szállítmány nem található</h2>
          <p className="text-red-600">A keresett szállítmány nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  // Convert VAT rates to Map format
  const vatMap = new Map<string, number>()
  vatRates.forEach(v => {
    vatMap.set(v.id, v.kulcs || 0)
  })

  return (
    <Suspense fallback={<ShipmentDetailSkeleton />}>
      <ShipmentDetailClient 
        id={id}
        initialHeader={shipmentData.header}
        initialItems={shipmentData.items}
        initialVatRates={vatMap}
      />
    </Suspense>
  )
}

