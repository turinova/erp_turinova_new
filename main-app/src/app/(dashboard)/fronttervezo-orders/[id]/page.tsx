import React from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getAllFeeTypes, getFronttervezoQuoteById } from '@/lib/supabase-server'

import FronttervezoOrderDetailClient from './FronttervezoOrderDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const order = await getFronttervezoQuoteById(id)

  return {
    title: order
      ? `Front megrendelés - ${order.order_number || order.quote_number}`
      : 'Front megrendelés'
  }
}

export const dynamic = 'force-dynamic'

export default async function FronttervezoOrderDetailPage({ params }: PageProps) {
  const { id } = await params

  const [orderData, feeTypes] = await Promise.all([
    getFronttervezoQuoteById(id),
    getAllFeeTypes()
  ])

  if (!orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Megrendelés nem található</h1>
          <p className="text-gray-600">
            A keresett front megrendelés nem létezik vagy nincs hozzáférésed hozzá.
          </p>
        </div>
      </div>
    )
  }

  if (orderData.status === 'draft') {
    redirect(`/fronttervezo-quotes/${id}`)
  }

  return (
    <FronttervezoOrderDetailClient
      initialQuoteData={
        orderData as Parameters<typeof FronttervezoOrderDetailClient>[0]['initialQuoteData']
      }
      feeTypes={feeTypes as never[]}
    />
  )
}
