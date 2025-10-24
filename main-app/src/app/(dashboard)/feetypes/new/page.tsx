import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import FeeTypeFormClient from '../FeeTypeFormClient'

export const metadata: Metadata = {
  title: 'Új díjtípus'
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

// Server-side rendered new fee type page
export default function NewFeeTypePage() {
  return (
    <Suspense fallback={<FeeTypeFormSkeleton />}>
      <FeeTypeFormClient initialFeeType={null} isEdit={false} />
    </Suspense>
  )
}
