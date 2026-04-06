import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { Box, CircularProgress } from '@mui/material'
import { getFavouriteCustomersWithRevenue } from '@/lib/supabase-server'
import FavouriteClient from './FavouriteClient'

export const metadata: Metadata = {
  title: 'Asztalosok'
}

export default async function FavouritePage() {
  const favourites = await getFavouriteCustomersWithRevenue()

  return (
    <Suspense fallback={<Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>}>
      <FavouriteClient initialCustomers={favourites} />
    </Suspense>
  )
}
