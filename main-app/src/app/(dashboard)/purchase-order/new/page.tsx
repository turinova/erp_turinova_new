import React from 'react'
import type { Metadata } from 'next'
import PurchaseOrderFormClient from '../purchase/PurchaseOrderFormClient'

export const metadata: Metadata = {
  title: 'Új beszállítói rendelés'
}

export default function NewPurchaseOrderPage() {
  return <PurchaseOrderFormClient mode="create" />
}


