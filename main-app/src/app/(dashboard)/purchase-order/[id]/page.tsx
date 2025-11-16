import React from 'react'
import type { Metadata } from 'next'
import PurchaseOrderFormClient from '../purchase/PurchaseOrderFormClient'

export const metadata: Metadata = {
  title: 'Beszállítói rendelés'
}

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  return <PurchaseOrderFormClient mode="edit" id={params.id} />
}


