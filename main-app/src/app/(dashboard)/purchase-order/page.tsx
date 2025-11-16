import React from 'react'
import type { Metadata } from 'next'
import { Box, Typography } from '@mui/material'

export const metadata: Metadata = {
  title: 'Beszállítói rendelése'
}

export default function PurchaseOrderPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1">
        Beszállítói rendelése
      </Typography>
    </Box>
  )
}


