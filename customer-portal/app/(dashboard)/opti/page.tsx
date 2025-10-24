import React from 'react'
import OptiClient from './OptiClient'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getAllCompanyData } from '@/lib/company-data-server'
import { getPortalQuoteById } from '@/lib/supabase-server'

export const metadata = {
  title: 'Ajánlat készítés - Turinova Ügyfélportál',
  description: 'Anyag optimalizálás'
}

interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function OptiPage({ searchParams }: PageProps) {
  const startTime = performance.now()
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.quote_id
  
  // Step 1: Get authenticated customer from portal database
  const cookieStore = await cookies()
  const portalSupabase = createServerClient(
    'https://oatbbtbkerxogzvwicxx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            console.error('Error setting cookies in Opti SSR:', error);
          }
        },
      },
    }
  )
  
  const { data: { user }, error: userError } = await portalSupabase.auth.getUser()
  
  if (userError || !user) {
    console.error('[Customer Portal Opti] User not authenticated:', userError?.message)
    return (
      <div className="p-6 text-center text-red-500">
        Nincs bejelentkezve, vagy hiba történt a felhasználói adatok lekérésekor.
      </div>
    )
  }
  
  // Step 2: Get customer's data and selected company
  const { data: customer, error: customerError } = await portalSupabase
    .from('portal_customers')
    .select(`
      id,
      name,
      email,
      mobile,
      discount_percent,
      selected_company_id,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number
    `)
    .eq('id', user.id)
    .single()
  
  if (customerError || !customer || !customer.selected_company_id) {
    console.error('[Customer Portal Opti] Customer or selected company not found:', customerError)
    return (
      <div className="p-6 text-center text-red-500">
        Nincs kiválasztott vállalat. Kérjük, válasszon egy vállalatot a Beállításokban.
      </div>
    )
  }
  
  // Step 3: Get company's Supabase credentials
  const { data: company, error: companyError } = await portalSupabase
    .from('companies')
    .select('id, name, supabase_url, supabase_anon_key')
    .eq('id', customer.selected_company_id)
    .eq('is_active', true)
    .single()
  
  if (companyError || !company) {
    console.error('[Customer Portal Opti] Company not found or inactive:', companyError)
    return (
      <div className="p-6 text-center text-red-500">
        A kiválasztott vállalat nem található vagy inaktív.
      </div>
    )
  }
  
  console.log(`[Customer Portal Opti] Loading data for company: ${company.name}`)
  
  // Step 4: Fetch all company data using helper functions (same pattern as main app)
  let materials = []
  let edgeMaterials = []
  let cuttingFee = 0
  
  try {
    const companyData = await getAllCompanyData({
      supabase_url: company.supabase_url,
      supabase_anon_key: company.supabase_anon_key
    })
    
    materials = companyData.materials
    edgeMaterials = companyData.edgeMaterials
    cuttingFee = companyData.cuttingFee
  } catch (error: any) {
    console.error('[Customer Portal Opti] Failed to fetch company data:', error)
    return (
      <div className="p-6 text-center text-red-500">
        <h2 className="text-xl font-bold mb-2">Hiba történt az adatok betöltésekor</h2>
        <p>Nem sikerült betölteni a vállalat adatait.</p>
        <p className="text-sm mt-2 text-gray-600">{error.message}</p>
        <p className="text-xs mt-2 text-gray-500">
          Kérjük, ellenőrizze, hogy a vállalat adatbázisa elérhető-e és a jogosultságok megfelelően vannak beállítva.
        </p>
      </div>
    )
  }
  
  // Step 5: Fetch portal quote if quote_id is provided (for editing)
  let quoteData = null
  if (quoteId) {
    console.log(`[Customer Portal Opti] Loading quote for editing: ${quoteId}`)
    quoteData = await getPortalQuoteById(quoteId)
    
    if (quoteData) {
      console.log(`[Customer Portal Opti] Loaded quote for editing: ${quoteData.quote_number}`)
    } else {
      console.error(`[Customer Portal Opti] Failed to load quote: ${quoteId}`)
    }
  }
  
  const totalTime = performance.now() - startTime
  console.log(`[Customer Portal Opti] SSR completed in ${totalTime.toFixed(2)}ms - Materials: ${materials.length}, Edge Materials: ${edgeMaterials.length}`)
  
  return (
    <OptiClient 
      initialMaterials={materials}
      initialEdgeMaterials={edgeMaterials}
      initialCuttingFee={cuttingFee}
      customerData={customer}
      initialQuoteData={quoteData}
    />
  )
}
