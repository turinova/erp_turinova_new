import React from 'react'
import { getAllMaterials, getAllCustomers, getAllEdgeMaterials, getCuttingFee } from '@/lib/supabase-server'
import OptiClient from './OptiClient'

export default async function OptiPage() {
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
    />
  )
}
