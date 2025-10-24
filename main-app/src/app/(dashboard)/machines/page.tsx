import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllProductionMachines } from '@/lib/supabase-server'
import MachinesListClient from './MachinesListClient'

export const metadata: Metadata = {
  title: 'Gépek'
}

interface ProductionMachine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
  created_at: string
  updated_at: string
}

// Loading skeleton component
function MachinesSkeleton() {
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

// Server-side rendered machines list page
export default async function MachinesPage() {
  const startTime = performance.now()

  // Fetch machines data on the server
  const machines = await getAllProductionMachines()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Machines Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<MachinesSkeleton />}>
      <MachinesListClient initialMachines={machines} />
    </Suspense>
  )
}
