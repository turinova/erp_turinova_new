import React from 'react'
import type { Metadata } from 'next'
import PurchaseOrderFormClient from '../purchase/PurchaseOrderFormClient'

export const metadata: Metadata = {
  title: 'Beszállítói rendelés'
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PurchaseOrderFormClient mode="edit" id={id} />
}


