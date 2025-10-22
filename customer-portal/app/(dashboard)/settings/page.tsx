import React, { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import SettingsClient from './SettingsClient'
import { CircularProgress, Box } from '@mui/material'

interface PortalCustomer {
  id: string
  name: string
  email: string
  mobile: string
  billing_name: string | null
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  sms_notification: boolean
  selected_company_id: string | null
  created_at: string
  updated_at: string
}

interface Company {
  id: string
  name: string
  slug: string
  is_active: boolean
}

// Loading skeleton component
function SettingsSkeleton() {
  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
      <CircularProgress />
    </Box>
  )
}

// Server-side rendered settings page
export default async function SettingsPage() {
  const startTime = performance.now()

  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return (
        <Box sx={{ p: 3 }}>
          <div>Nem sikerült betölteni a felhasználói adatokat</div>
        </Box>
      )
    }

    // Fetch current customer data
    const { data: customer, error: customerError } = await supabase
      .from('portal_customers')
      .select('*')
      .eq('id', user.id)
      .single()

    if (customerError || !customer) {
      console.error('Error fetching customer:', customerError)
      return (
        <Box sx={{ p: 3 }}>
          <div>Nem sikerült betölteni az ügyfél adatokat</div>
        </Box>
      )
    }

    // Fetch all active companies for dropdown
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .order('name')

    if (companiesError) {
      console.error('Error fetching companies:', companiesError)
    }

    const totalTime = performance.now()
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PERF] Settings Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
    }

    // Pass pre-loaded data to client component with Suspense boundary
    return (
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsClient 
          initialCustomer={customer as PortalCustomer} 
          companies={companies as Company[] || []}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error in settings page:', error)
    return (
      <Box sx={{ p: 3 }}>
        <div>Hiba történt az oldal betöltése során</div>
      </Box>
    )
  }
}

