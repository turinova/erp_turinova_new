import React from 'react'
import type { Metadata } from 'next'
import PurchaseOrderListClient from './PurchaseOrderListClient'
import { Box } from '@mui/material'

export const metadata: Metadata = {
  title: 'Beszállítói rendelése'
}

export default async function PurchaseOrderPage() {
  return (
    <Box sx={{ p: 0 }}>
      <PurchaseOrderListClient />
    </Box>
  )
}


