import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllEmployees } from '@/lib/supabase-server'
import { getEmployeesMonthlyAttention } from '@/lib/dashboard-server'
import { getBudapestYearMonth } from '@/components/attendance/attendanceUtils'
import EmployeesList from './EmployeesList'

export const metadata: Metadata = {
  title: 'Kollégák'
}

interface EmployeesPageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

function parseViewMonth(searchParams: { year?: string; month?: string }): { year: number; month: number } {
  const fallback = getBudapestYearMonth()
  const year = searchParams.year ? parseInt(searchParams.year, 10) : fallback.year
  const month = searchParams.month ? parseInt(searchParams.month, 10) : fallback.month

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return fallback
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { year, month: fallback.month }
  }

  return { year, month }
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
export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const startTime = performance.now()
  const resolvedSearchParams = await searchParams
  const { year, month } = parseViewMonth(resolvedSearchParams)

  const [employees, monthlyAttention] = await Promise.all([
    getAllEmployees(),
    getEmployeesMonthlyAttention(year, month)
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Employees Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  return (
    <Suspense fallback={<EmployeesSkeleton />}>
      <EmployeesList
        initialEmployees={employees}
        initialMonthlyAttention={monthlyAttention}
        viewYear={year}
        viewMonth={month}
      />
    </Suspense>
  )
}
