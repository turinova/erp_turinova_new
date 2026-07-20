import type { Metadata } from 'next'

import {
  getAllCustomers,
  getAllMaterials,
  getCuttingFee,
  getEdgeMaterialById,
  getFronttervezoQuoteById,
  getNettfrontSkus
} from '@/lib/supabase-server'
import { buildInomatCatalogFromSkus } from '@/lib/pricing/inomatCatalog'
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

  const inomatCatalog = buildInomatCatalogFromSkus(nettfrontSkus || [])
  if (inomatCatalog.length === 0) {
    return (
      <div className="p-6 text-center text-red-500">
        <h2 className="text-xl font-bold mb-2">Nettfront árak nem elérhetők</h2>
        <p>
          Nem sikerült betölteni a Nettfront SKU árakat. Fallback árakat nem használunk.
        </p>
        <p className="text-sm mt-2 text-gray-600">
          Ellenőrizze a <code>nettfront_skus</code> táblát (aktív Inomat SKU-k, eladási ár &gt; 0).
        </p>
      </div>
    )
  }

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
