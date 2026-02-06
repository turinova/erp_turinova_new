import type { Metadata } from 'next'
import { getAllCustomers, getAllLinearMaterials, getWorktopConfigFees } from '@/lib/supabase-server'
import WorktopConfigClient from './WorktopConfigClient'

export const metadata: Metadata = {
  title: 'Munkalép készítés'
}

export default async function WorktopConfigPage() {
  const [customers, linearMaterials, worktopConfigFees] = await Promise.all([
    getAllCustomers(),
    getAllLinearMaterials(),
    getWorktopConfigFees()
  ])

  return (
    <WorktopConfigClient 
      initialCustomers={customers} 
      initialLinearMaterials={linearMaterials}
      initialWorktopConfigFees={worktopConfigFees}
    />
  )
}
