import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllCompanies } from '@/lib/supabase-server'
import CompanyClient from './CompanyClient'

export const metadata: Metadata = {
  title: 'Cégadatok'
}

interface TenantCompany {
  id: string
  name: string
  country: string
  postal_code: string
  city: string
  address: string
  phone_number: string
  email: string
  website: string
  tax_number: string
  company_registration_number: string
  vat_id: string
  created_at: string
  updated_at: string
}

// Loading skeleton component
function CompanySkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Server-side rendered company page
export default async function CompanyPage() {
  const startTime = performance.now()

  // Fetch companies data on the server
  const companies = await getAllCompanies()
  const company = companies?.[0] || null

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Company Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<CompanySkeleton />}>
      <CompanyClient initialCompany={company} />
    </Suspense>
  )
}