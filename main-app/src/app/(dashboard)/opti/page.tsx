import React from 'react'
import type { Metadata } from 'next'
import { getAllMaterials, getAllCustomers, getAllEdgeMaterials, getCuttingFee, getQuoteById } from '@/lib/supabase-server'
import OptiClient from './OptiClient'

export const metadata: Metadata = {
  title: 'Ajánlat készítés'
}

interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function OptiPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.quote_id
  
  // Fetch all data in parallel (including quote if quote_id is provided)
  const [materials, customers, edgeMaterials, cuttingFee, quoteData] = await Promise.all([
    getAllMaterials(),
    getAllCustomers(),
    getAllEdgeMaterials(),
    getCuttingFee(),
    quoteId ? getQuoteById(quoteId) : Promise.resolve(null)
  ])
  
  // Log quote loading for debugging
  if (quoteId) {
    if (quoteData) {
      console.log(`[SSR Page] Loaded quote for editing: ${quoteData.quote_number}`)
    } else {
      console.error(`[SSR Page] Failed to load quote: ${quoteId}`)
    }
  }
  
  return (
    <OptiClient 
      initialMaterials={materials}
      initialCustomers={customers}
      initialEdgeMaterials={edgeMaterials}
      initialCuttingFee={cuttingFee}
      initialQuoteData={quoteData}
    />
  )
}
