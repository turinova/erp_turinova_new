import type { Metadata } from 'next'
import { getAllCustomers, getAllLinearMaterials } from '@/lib/supabase-server'
import WorktopConfigClient from './WorktopConfigClient'

export const metadata: Metadata = {
  title: 'Munkalép készítés'
}

export default async function WorktopConfigPage() {
  const customers = await getAllCustomers()
  const linearMaterials = await getAllLinearMaterials()

  return (
    <WorktopConfigClient initialCustomers={customers} initialLinearMaterials={linearMaterials} />
  )
}
