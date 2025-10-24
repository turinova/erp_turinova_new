import React from 'react'
import type { Metadata } from 'next'
import { getQuoteById, getAllFeeTypes, getAllAccessories, getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners, getAllProductionMachines } from '@/lib/supabase-server'
import OrderDetailClient from './OrderDetailClient'

interface PageProps {
  params: Promise<{ order_id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const orderData = await getQuoteById(resolvedParams.order_id)
  
  return {
    title: orderData ? `Megrendelés - ${orderData.quote_number}` : 'Megrendelés'
  }
}

export default async function OrderDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const orderId = resolvedParams.order_id
  
  // Fetch all data in parallel for SSR (same as quote page)
  const [orderData, feeTypes, accessories, vatRates, currencies, units, partners, machines] = await Promise.all([
    getQuoteById(orderId), // Orders ARE quotes, just use same function
    getAllFeeTypes(),
    getAllAccessories(),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners(),
    getAllProductionMachines()
  ])
  
  if (!orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Megrendelés nem található</h1>
          <p className="text-gray-600">A keresett megrendelés nem létezik vagy nincs hozzáférésed hozzá.</p>
        </div>
      </div>
    )
  }
  
  return (
    <OrderDetailClient 
      initialQuoteData={orderData}
      feeTypes={feeTypes}
      accessories={accessories}
      vatRates={vatRates}
      currencies={currencies}
      units={units}
      partners={partners}
      machines={machines}
    />
  )
}

