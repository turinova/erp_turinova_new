import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { Box, CircularProgress } from '@mui/material'
import { getCustomerById } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import CustomerDashboardClient from './CustomerDashboardClient'

export const metadata: Metadata = {
  title: 'Ügyfél dashboard'
}

export default async function CustomerDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await getCustomerById(id)

  if (!customer) notFound()

  return (
    <Suspense fallback={<Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>}>
      <CustomerDashboardClient customer={customer as any} />
    </Suspense>
  )
}
