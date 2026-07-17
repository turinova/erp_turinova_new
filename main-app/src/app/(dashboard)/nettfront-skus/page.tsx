import React, { Suspense } from 'react'
import type { Metadata } from 'next'

import { getAllNettfrontSkus } from '@/lib/supabase-server'

import NettfrontSkusListClient from './NettfrontSkusListClient'

export const metadata: Metadata = {
  title: 'Nettfront anyagok'
}

function Skeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="h-10 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function NettfrontSkusPage() {
  const skus = await getAllNettfrontSkus()

  return (
    <Suspense fallback={<Skeleton />}>
      <NettfrontSkusListClient initialSkus={skus} />
    </Suspense>
  )
}
