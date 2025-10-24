import React from 'react'
import type { Metadata } from 'next'
import { getShopOrderById } from '@/lib/supabase-server'
import ShopOrderEditClient from './ShopOrderEditClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const orderData = await getShopOrderById(resolvedParams.id)
  
  return {
    title: orderData ? `Beszerzés - ${orderData.customer_name}` : 'Beszerzés szerkesztése'
  }
}

export default async function ShopOrderEditPage({ params }: PageProps) {
  const resolvedParams = await params
  const orderId = resolvedParams.id
  
  // Fetch shop order data
  const orderData = await getShopOrderById(orderId)
  
  if (!orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Beszerzés nem található</h1>
          <p className="text-gray-600">A keresett beszerzés nem létezik vagy nincs hozzáférésed hozzá.</p>
        </div>
      </div>
    )
  }
  
  return (
    <ShopOrderEditClient 
      initialOrderData={orderData}
    />
  )
}
