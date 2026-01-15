import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllEmployees } from '@/lib/supabase-server'
import EmployeesList from './EmployeesList'

export const metadata: Metadata = {
  title: 'Kollégák'
}

interface Employee {
  id: string
  name: string
  employee_code: string
  rfid_card_id: string | null
  pin_code: string | null
  active: boolean
  lunch_break_start: string | null
  lunch_break_end: string | null
  created_at: string
  updated_at: string
}

// Loading skeleton component
function EmployeesSkeleton() {
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

// Server-side rendered employees list page
export default async function EmployeesPage() {
  const startTime = performance.now()

  // Fetch employees data on the server
  const employees = await getAllEmployees()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Employees Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to SSR component with Suspense boundary
  return (
    <Suspense fallback={<EmployeesSkeleton />}>
      <EmployeesList initialEmployees={employees} />
    </Suspense>
  )
}
