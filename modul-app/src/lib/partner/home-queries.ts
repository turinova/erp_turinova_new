import type { SupabaseClient } from '@supabase/supabase-js'

import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'
import { createClient } from '@/lib/supabase/server'

export type PartnerHomeContact = {
  phone: string | null
  email: string | null
  website: string | null
  addressLine: string | null
}

export type PartnerHomeData = {
  companyLabel: string | null
  contact: PartnerHomeContact | null
  draftCount: number
  submittedCount: number
}

function buildAddressLine(row: {
  country: string | null
  postal_code: string | null
  city: string | null
  address: string | null
}): string | null {
  const cityLine = [row.postal_code, row.city].filter(Boolean).join(' ').trim()
  const parts = [row.country, cityLine || null, row.address]
    .map((p) => p?.trim())
    .filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(' · ') : null
}

function contactFromRow(row: {
  phone_number: string | null
  email: string | null
  website: string | null
  country: string
  postal_code: string | null
  city: string | null
  address: string | null
}): PartnerHomeContact | null {
  const phone = row.phone_number?.trim() || null
  const email = row.email?.trim() || null
  const website = row.website?.trim() || null
  const addressLine = buildAddressLine(row)
  if (!phone && !email && !website && !addressLine) return null
  return { phone, email, website, addressLine }
}

async function countPartnerQuotes(
  supabase: SupabaseClient,
  partnerId: string,
  kind: 'draft' | 'submitted'
): Promise<number> {
  let query = supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('partner_profile_id', partnerId)
    .eq('source', 'portal')
    .is('deleted_at', null)

  if (kind === 'draft') {
    query = query.is('portal_submitted_at', null).eq('status', 'draft')
  } else {
    query = query.not('portal_submitted_at', 'is', null)
  }

  const { count, error } = await query
  if (error) {
    console.error('countPartnerQuotes', kind, error.message)
    return 0
  }
  return count ?? 0
}

export async function loadPartnerHomeData(
  partnerId: string,
  selectedTenantId: string | null
): Promise<PartnerHomeData> {
  const companyLabel = await resolvePartnerCompanyLabel(selectedTenantId)

  const supabase = await createClient()
  if (!supabase) {
    return {
      companyLabel,
      contact: null,
      draftCount: 0,
      submittedCount: 0
    }
  }

  const [draftCount, submittedCount, companyRow] = await Promise.all([
    countPartnerQuotes(supabase, partnerId, 'draft'),
    countPartnerQuotes(supabase, partnerId, 'submitted'),
    selectedTenantId
      ? supabase
          .from('tenant_companies')
          .select(
            'phone_number, email, website, country, postal_code, city, address'
          )
          .eq('tenant_id', selectedTenantId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('loadPartnerHomeData company', error.message)
              return null
            }
            return data
          })
      : Promise.resolve(null)
  ])

  return {
    companyLabel,
    contact: companyRow ? contactFromRow(companyRow) : null,
    draftCount,
    submittedCount
  }
}
