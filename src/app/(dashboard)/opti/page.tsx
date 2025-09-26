import React from 'react'
import { getAllMaterials, getAllCustomers, getAllEdgeMaterials } from '@/lib/supabase-server'
import OptiClient from './OptiClient'

export default async function OptiPage() {
  const [materials, customers, edgeMaterials] = await Promise.all([
    getAllMaterials(),
    getAllCustomers(),
    getAllEdgeMaterials()
  ])
  
  return (
    <OptiClient 
      initialMaterials={materials}
      initialCustomers={customers}
      initialEdgeMaterials={edgeMaterials}
    />
  )
}
