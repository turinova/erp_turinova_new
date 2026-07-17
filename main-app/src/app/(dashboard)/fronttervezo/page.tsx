import type { Metadata } from 'next'

import {
  getAllCustomers,
  getAllMaterials,
  getCuttingFee,
  getEdgeMaterialById,
  getFronttervezoQuoteById,
  getNettfrontSkus
} from '@/lib/supabase-server'
import FronttervezoClient from './FronttervezoClient'

export const metadata: Metadata = {
  title: 'Fronttervező'
}

interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function FronttervezoPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.quote_id
  const defaultEdgeMaterialId = '5c8e4557-ee96-44fc-94e9-19c6bba1c5e4'

  const [customers, materials, cuttingFee, nettfrontSkus, quoteData] = await Promise.all([
    getAllCustomers(),
    getAllMaterials(),
    getCuttingFee(),
    getNettfrontSkus(),
    quoteId ? getFronttervezoQuoteById(quoteId) : Promise.resolve(null)
  ])

  return (
    <FronttervezoClient
      initialCustomers={customers}
      initialMaterials={materials}
      initialCuttingFee={cuttingFee}
      initialDefaultEdgeMaterial={await getEdgeMaterialById(defaultEdgeMaterialId)}
      initialNettfrontSkus={nettfrontSkus}
      initialQuoteData={quoteData}
    />
  )
}
