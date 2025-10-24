import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getFeeTypeById } from '@/lib/supabase-server'
import FeeTypeFormClient from '../FeeTypeFormClient'

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_id: string
  currency_id: string
  created_at: string
  updated_at: string
  vat_name: string
  vat_percent: number
  currency_name: string
  vat_amount: number
  gross_price: number
}

interface FeeTypeFormPageProps {
  params: Promise<{ id: string }>
}

// Loading skeleton component
function FeeTypeFormSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: FeeTypeFormPageProps): Promise<Metadata> {
  const { id } = await params
  
  if (id === 'new') {
    return { title: 'Új díjtípus' }
  }
  
  const feeType = await getFeeTypeById(id)
  return {
    title: feeType ? `Díjtípus - ${feeType.name}` : 'Díjtípus szerkesztése'
  }
}

// Server-side rendered fee type form page
export default async function FeeTypeFormPage({ params }: FeeTypeFormPageProps) {
  const { id } = await params
  const isEdit = id !== 'new'
  
  let feeType: FeeType | null = null
  
  if (isEdit) {
    feeType = await getFeeTypeById(id)
  }

  return (
    <Suspense fallback={<FeeTypeFormSkeleton />}>
      <FeeTypeFormClient initialFeeType={feeType} isEdit={isEdit} />
    </Suspense>
  )
}
