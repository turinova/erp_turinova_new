import React from 'react'
import type { Metadata } from 'next'
import { getAllCustomers } from '@/lib/supabase-server'
import PosClient from './PosClient'

export const metadata: Metadata = {
  title: 'Pos'
}

export default async function PosPage() {
  const customers = await getAllCustomers()

  return <PosClient customers={customers} />
}

