import React from 'react'
import type { Metadata } from 'next'
import { getAllShopOrders } from '@/lib/supabase-server'
import CustomerOrdersClient from './CustomerOrdersClient'

export const metadata: Metadata = {
  title: 'Ügyfél rendelések'
}

// Server-side rendered customer orders page
export default async function CustomerOrdersPage() {
  const startTime = performance.now()

  // Fetch shop orders data
  const orders = await getAllShopOrders()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Customer Orders Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  return (
    <CustomerOrdersClient orders={orders} />
  )
}