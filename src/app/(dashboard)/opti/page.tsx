import React from 'react'
import { getAllMaterials, getAllCustomers, getAllEdgeMaterials, getCuttingFee } from '@/lib/supabase-server'
import OptiClient from './OptiClient'

interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function OptiPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.quote_id
  
  // Fetch quote data if quote_id is provided
  let quoteData = null
  if (quoteId) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/quotes/${quoteId}`, {
        cache: 'no-store'
      })
      
      if (response.ok) {
        quoteData = await response.json()
        console.log(`Loaded quote for editing: ${quoteData.quote_number}`)
      } else {
        console.error('Failed to load quote:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading quote:', error)
    }
  }
  
  const [materials, customers, edgeMaterials, cuttingFee] = await Promise.all([
    getAllMaterials(),
    getAllCustomers(),
    getAllEdgeMaterials(),
    getCuttingFee()
  ])
  
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
