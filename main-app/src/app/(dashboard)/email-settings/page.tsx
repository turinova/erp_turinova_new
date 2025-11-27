import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase-server'
import EmailSettingsClient from './EmailSettingsClient'

export const metadata: Metadata = {
  title: 'Email beállítások'
}

interface SMTPSetting {
  id: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from_email: string
  from_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Loading skeleton component
function EmailSettingsSkeleton() {
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

// Server-side rendered email settings page
export default async function EmailSettingsPage() {
  const startTime = performance.now()

  // Fetch SMTP settings
  const { data: smtpSettings, error } = await supabaseServer
    .from('smtp_settings')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('Error fetching SMTP settings:', error)
  }

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Email Settings Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<EmailSettingsSkeleton />}>
      <EmailSettingsClient initialSettings={smtpSettings as SMTPSetting | null} />
    </Suspense>
  )
}

