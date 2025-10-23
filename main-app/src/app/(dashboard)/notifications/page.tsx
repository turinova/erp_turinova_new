import React, { Suspense } from 'react'
import { getSmsSettings, getTenantCompany } from '@/lib/supabase-server'
import NotificationsClient from './NotificationsClient'

interface SmsSettings {
  id: string
  message_template: string
  created_at: string
  updated_at: string
}

// Loading skeleton component
function NotificationsSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded w-1/6"></div>
        </div>
      </div>
    </div>
  )
}

// Server-side rendered notifications page
export default async function NotificationsPage() {
  const startTime = performance.now()

  // Fetch SMS settings and company data on the server
  const [smsSettings, companyData] = await Promise.all([
    getSmsSettings(),
    getTenantCompany()
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Notifications Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <NotificationsClient 
        initialSettings={smsSettings} 
        companyName={companyData?.name || 'Turinova'} 
      />
    </Suspense>
  )
}

