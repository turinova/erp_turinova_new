import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllPartners } from '@/lib/supabase-server'
import PartnersListClient from './PartnersListClient'

export const metadata: Metadata = {
  title: 'Beszállítók',
  description: 'Beszállítók kezelése'
}

interface Partner {
  id: string
  name: string
  country: string
  postal_code: string
  city: string
  address: string
  mobile: string
  email: string
  tax_number: string
  company_registration_number: string
  bank_account: string
  notes: string
  status: string
  contact_person: string
  vat_id: string
  currency_id: string
  payment_terms: number
  created_at: string
  updated_at: string
  vat: {
    name: string
    kulcs: number
  }
  currencies: {
    name: string
    rate: number
  }
}

// Loading skeleton component
function PartnersSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Server-side rendered partners list page
export default async function PartnersPage() {
  const startTime = performance.now()

  // Fetch partners data on the server
  const partners = await getAllPartners()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Partners Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<PartnersSkeleton />}>
      <PartnersListClient initialPartners={partners} />
    </Suspense>
  )
}
