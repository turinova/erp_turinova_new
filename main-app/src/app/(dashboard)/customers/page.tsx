import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllCustomers } from '@/lib/supabase-server'
import CustomersListClient from './CustomersListClient'

export const metadata: Metadata = {
  title: 'Ügyfelek'
}

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  discount_percent: number
  sms_notification: boolean
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  created_at: string
  updated_at: string
}

// Loading skeleton component
function CustomersSkeleton() {
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

// Server-side rendered customers list page
export default async function CustomersPage() {
  const startTime = performance.now()

  // Fetch customers data on the server
  const customers = await getAllCustomers()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Customers Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<CustomersSkeleton />}>
      <CustomersListClient initialCustomers={customers} />
    </Suspense>
  )
}
