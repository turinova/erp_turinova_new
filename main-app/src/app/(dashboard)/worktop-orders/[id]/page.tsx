import React from 'react'
import type { Metadata } from 'next'
import { getWorktopQuoteById, getTenantCompany, getAllProductionMachines } from '@/lib/supabase-server'
import WorktopOrderDetailClient from './WorktopOrderDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const quoteData = await getWorktopQuoteById(resolvedParams.id)
  
  return {
    title: quoteData ? `Megrendelés - ${quoteData.order_number || quoteData.quote_number}` : 'Megrendelés'
  }
}

export default async function WorktopOrderDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const orderId = resolvedParams.id
  
  // Fetch worktop quote data, tenant company, and machines in parallel
  const [quoteData, tenantCompany, machines] = await Promise.all([
    getWorktopQuoteById(orderId),
    getTenantCompany(),
    getAllProductionMachines()
  ])
  
  if (!quoteData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Munkalap megrendelés nem található</h1>
          <p className="text-gray-600">A keresett munkalap megrendelés nem létezik vagy nincs hozzáférésed hozzá.</p>
        </div>
      </div>
    )
  }
  
  return (
    <WorktopOrderDetailClient 
      initialQuoteData={quoteData}
      tenantCompany={tenantCompany}
      machines={machines}
    />
  )
}
