import React, { Suspense } from 'react'
import { getAllWorkers } from '@/lib/supabase-server'
import WorkersList from './WorkersList'

interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
  created_at: string
  updated_at: string
}

// Loading skeleton component
function WorkersSkeleton() {
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

// Server-side rendered workers list page
export default async function WorkersPage() {
  const startTime = performance.now()

  // Fetch workers data on the server
  const workers = await getAllWorkers()

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Workers Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to SSR component with Suspense boundary
  return (
    <Suspense fallback={<WorkersSkeleton />}>
      <WorkersList initialWorkers={workers} />
    </Suspense>
  )
}
