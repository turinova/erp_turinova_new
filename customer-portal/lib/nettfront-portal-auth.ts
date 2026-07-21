import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/** Shared portal auth + selected company for Nettfront APIs */
export async function getPortalAuthContext() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            /* ignore in RSC */
          }
        }
      }
    }
  )

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Unauthorized' as const, status: 401 as const }
  }

  const { data: portalCustomer, error: customerError } = await supabase
    .from('portal_customers')
    .select(
      `
      id, email, name, mobile, discount_percent, selected_company_id,
      billing_name, billing_country, billing_city, billing_postal_code,
      billing_street, billing_house_number, billing_tax_number, billing_company_reg_number
    `
    )
    .eq('id', user.id)
    .single()

  if (customerError || !portalCustomer) {
    return { error: 'Portal customer not found' as const, status: 404 as const }
  }

  if (!portalCustomer.selected_company_id) {
    return {
      error: 'No company selected. Please select a company in settings.' as const,
      status: 400 as const
    }
  }

  return { supabase, user, portalCustomer }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
