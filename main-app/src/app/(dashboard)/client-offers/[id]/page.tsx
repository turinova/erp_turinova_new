import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getClientOfferById, getAllCustomers, getAllVatRates, getAllUnits, getAllWorkers, getAllFeeTypes } from '@/lib/supabase-server'
import ClientOfferDetailClient from './ClientOfferDetailClient'

function ClientOfferDetailSkeleton() {
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
  
  if (id === 'new') {
    return {
      title: 'Új ajánlat'
    }
  }
  
  const offerData = await getClientOfferById(id)
  
  return {
    title: offerData ? `Ajánlat - ${offerData.offer.offer_number}` : 'Ajánlat'
  }
}

export default async function ClientOfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const startTime = performance.now()

  // If new offer, don't fetch offer data
  const isNew = id === 'new'

  // Fetch all required data on the server
  const [offerData, customers, vatRates, units, workers, feeTypes] = await Promise.all([
    isNew ? Promise.resolve(null) : getClientOfferById(id),
    getAllCustomers(),
    getAllVatRates(),
    getAllUnits(),
    getAllWorkers(),
    getAllFeeTypes()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Client Offer Detail Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  if (!isNew && !offerData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Ajánlat nem található</h2>
          <p className="text-red-600">A keresett ajánlat nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<ClientOfferDetailSkeleton />}>
      <ClientOfferDetailClient 
        id={isNew ? null : id}
        initialOffer={offerData?.offer || null}
        initialItems={offerData?.items || []}
        initialCustomers={customers}
        initialVatRates={vatRates}
        initialUnits={units}
        initialWorkers={workers}
        initialFeeTypes={feeTypes}
      />
    </Suspense>
  )
}

