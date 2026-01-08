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
  signature_html: string | null
  is_active: boolean
  imap_host: string
  imap_port: number
  imap_secure: boolean
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

  // Fetch all SMTP settings (not just active)
  const { data: smtpSettings, error } = await supabaseServer
    .from('smtp_settings')
    .select('id, host, port, secure, "user", password, from_email, from_name, signature_html, is_active, imap_host, imap_port, imap_secure, created_at, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

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
      <EmailSettingsClient initialSettings={smtpSettings as SMTPSetting[] || []} />
    </Suspense>
  )
}

