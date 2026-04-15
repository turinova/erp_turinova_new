import type { Metadata } from 'next'

import { getAllCustomers, getAllMaterials, getCuttingFee, getEdgeMaterialById } from '@/lib/supabase-server'
import FronttervezoClient from './FronttervezoClient'

export const metadata: Metadata = {
  title: 'Fronttervező'
}

export default async function FronttervezoPage() {
  const defaultEdgeMaterialId = '5c8e4557-ee96-44fc-94e9-19c6bba1c5e4'

  const [customers, materials, cuttingFee] = await Promise.all([
    getAllCustomers(),
    getAllMaterials(),
    getCuttingFee()
  ])

  return (
    <FronttervezoClient
      initialCustomers={customers}
      initialMaterials={materials}
      initialCuttingFee={cuttingFee}
      initialDefaultEdgeMaterial={await getEdgeMaterialById(defaultEdgeMaterialId)}
    />
  )
}
