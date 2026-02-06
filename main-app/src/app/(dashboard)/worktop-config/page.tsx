import type { Metadata } from 'next'
import { getAllCustomers, getAllLinearMaterials, getWorktopConfigFees, getWorktopQuoteById } from '@/lib/supabase-server'
import WorktopConfigClient from './WorktopConfigClient'

export const metadata: Metadata = {
  title: 'Munkalép készítés'
}

interface PageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function WorktopConfigPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.id

  const [customers, linearMaterials, worktopConfigFees, initialQuoteData] = await Promise.all([
    getAllCustomers(),
    getAllLinearMaterials(),
    getWorktopConfigFees(),
    quoteId ? getWorktopQuoteById(quoteId) : Promise.resolve(null)
  ])

  return (
    <WorktopConfigClient 
      initialCustomers={customers} 
      initialLinearMaterials={linearMaterials}
      initialWorktopConfigFees={worktopConfigFees}
      initialQuoteData={initialQuoteData}
    />
  )
}
