import React from 'react'
import type { Metadata } from 'next'
import { getAllCustomers, getAllWorkers } from '@/lib/supabase-server'
import PosClient from './PosClient'

export const metadata: Metadata = {
  title: 'Pos'
}

export default async function PosPage() {
  const [customers, workers] = await Promise.all([
    getAllCustomers(),
    getAllWorkers()
  ])

  return <PosClient customers={customers} workers={workers} />
}

