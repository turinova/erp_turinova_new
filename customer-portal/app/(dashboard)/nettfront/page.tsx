import React from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import {
  getAllCompanyData,
  getCompanyCustomers,
  getCompanyEdgeMaterialById,
  getCompanyNettfrontSkus
} from '@/lib/company-data-server'
import { buildInomatCatalogFromSkus } from '@/lib/pricing/inomatCatalog'
import { getPortalNettfrontQuoteById } from '@/lib/supabase-server'

import FronttervezoClient, { type FronttervezoCustomer } from './FronttervezoClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nettfront - Turinova Ügyfélportál',
  description: 'Nettfront fronttervezés'
}

const DEFAULT_EDGE_MATERIAL_ID = '5c8e4557-ee96-44fc-94e9-19c6bba1c5e4'

function matchTenantCustomer(
  customers: FronttervezoCustomer[],
  portalEmail: string | null | undefined
): FronttervezoCustomer | null {
  const email = (portalEmail || '').trim().toLowerCase()
  if (!email) return null
  return (
    customers.find(c => (c.email || '').trim().toLowerCase() === email) || null
  )
}

interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function NettfrontPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.quote_id

  const cookieStore = await cookies()
  const portalSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oatbbtbkerxogzvwicxx.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
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
          } catch {
            /* ignore */
          }
        }
      }
    }
  )

  const {
    data: { user },
    error: userError
  } = await portalSupabase.auth.getUser()

  if (userError || !user) {
    return (
      <div className="p-6 text-center text-red-500">
        Nincs bejelentkezve, vagy hiba történt a felhasználói adatok lekérésekor.
      </div>
    )
  }

  const { data: portalCustomer, error: customerError } = await portalSupabase
    .from('portal_customers')
    .select('id, email, name, selected_company_id')
    .eq('id', user.id)
    .single()

  if (customerError || !portalCustomer?.selected_company_id) {
    return (
      <div className="p-6 text-center text-red-500">
        Nincs kiválasztott vállalat. Kérjük, válasszon egy vállalatot a Beállításokban.
      </div>
    )
  }

  const { data: company, error: companyError } = await portalSupabase
    .from('companies')
    .select('id, name, supabase_url, supabase_anon_key')
    .eq('id', portalCustomer.selected_company_id)
    .eq('is_active', true)
    .single()

  if (companyError || !company) {
    return (
      <div className="p-6 text-center text-red-500">
        A kiválasztott vállalat nem található vagy inaktív.
      </div>
    )
  }

  const creds = {
    supabase_url: company.supabase_url,
    supabase_anon_key: company.supabase_anon_key
  }

  try {
    const [companyData, customersRaw, nettfrontSkus, defaultEdge, existingQuote] =
      await Promise.all([
        getAllCompanyData(creds),
        getCompanyCustomers(creds),
        getCompanyNettfrontSkus(creds),
        getCompanyEdgeMaterialById(creds, DEFAULT_EDGE_MATERIAL_ID),
        quoteId ? getPortalNettfrontQuoteById(quoteId) : Promise.resolve(null)
      ])

    const customers = (customersRaw || []) as FronttervezoCustomer[]
    const lockedCustomer = matchTenantCustomer(
      customers,
      portalCustomer.email || user.email
    )

    const inomatCatalog = buildInomatCatalogFromSkus(nettfrontSkus || [])
    if (inomatCatalog.length === 0) {
      return (
        <div className="p-6 text-center text-red-500">
          <h2 className="text-xl font-bold mb-2">Nettfront árak nem elérhetők</h2>
          <p>
            Nem sikerült betölteni a Nettfront SKU árakat a vállalat adatbázisából.
            Fallback árakat nem használunk.
          </p>
          <p className="text-sm mt-2 text-gray-600">
            Ellenőrizze a <code>nettfront_skus</code> táblát és az anon SELECT jogosultságot
            (RLS policy), majd frissítse az oldalt.
          </p>
        </div>
      )
    }

    if (quoteId && !existingQuote) {
      return (
        <div className="p-6 text-center text-red-500">
          A szerkesztendő Nettfront ajánlat nem található.
        </div>
      )
    }

    const snap = (existingQuote?.customer_snapshot || {}) as Record<string, string | number | null>
    const initialQuoteData = existingQuote
      ? {
          id: existingQuote.id,
          quote_number: existingQuote.quote_number,
          status: existingQuote.status,
          discount_percent: Number(existingQuote.discount_percent) || 0,
          customer: {
            id: String(snap.id || lockedCustomer?.id || ''),
            name: String(snap.name || lockedCustomer?.name || ''),
            email: String(snap.email || lockedCustomer?.email || ''),
            mobile: String(snap.mobile || lockedCustomer?.mobile || ''),
            discount_percent:
              Number(snap.discount_percent ?? existingQuote.discount_percent) || 0,
            billing_name: String(snap.billing_name || ''),
            billing_country: String(snap.billing_country || 'Magyarország'),
            billing_city: String(snap.billing_city || ''),
            billing_postal_code: String(snap.billing_postal_code || ''),
            billing_street: String(snap.billing_street || ''),
            billing_house_number: String(snap.billing_house_number || ''),
            billing_tax_number: String(snap.billing_tax_number || ''),
            billing_company_reg_number: String(snap.billing_company_reg_number || '')
          },
          lines: (existingQuote.lines || []).map(l => ({
            id: l.id as string,
            front_type: l.front_type as string,
            display_name: l.display_name as string,
            height_mm: l.height_mm as number,
            width_mm: l.width_mm as number,
            quantity: l.quantity as number,
            panthely: l.panthely as never,
            megjegyzes: (l.megjegyzes as string | null) ?? null
          }))
        }
      : null

    return (
      <FronttervezoClient
        initialCustomers={customers}
        initialMaterials={companyData.materials as never[]}
        initialCuttingFee={companyData.cuttingFee as never}
        initialDefaultEdgeMaterial={(defaultEdge || null) as never}
        initialNettfrontSkus={nettfrontSkus}
        initialQuoteData={initialQuoteData}
        lockCustomerFields
        initialLockedCustomer={lockedCustomer}
        portalCustomerEmail={portalCustomer.email || user.email || null}
      />
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba'
    return (
      <div className="p-6 text-center text-red-500">
        <h2 className="text-xl font-bold mb-2">Hiba történt az adatok betöltésekor</h2>
        <p>Nem sikerült betölteni a Nettfront / vállalati adatokat.</p>
        <p className="text-sm mt-2 text-gray-600">{message}</p>
      </div>
    )
  }
}
