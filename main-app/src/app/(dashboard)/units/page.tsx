import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllUnits } from '@/lib/supabase-server'
import UnitsListClient from './UnitsListClient'

export const metadata: Metadata = {
  title: 'Egységek'
}

interface Unit {
  id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
}

// Loading skeleton component
function UnitsSkeleton() {
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

// Server-side rendered units list page
export default async function UnitsPage() {
  const startTime = performance.now()

  // Fetch units data on the server
  const units = await getAllUnits()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Units Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<UnitsSkeleton />}>
      <UnitsListClient initialUnits={units} />
    </Suspense>
  )
}
