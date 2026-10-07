import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import { searchCustomersForSelect } from '@/lib/search/select-search'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Nincs belépés.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim() ?? ''
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 25))

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  try {
    if (id) {
      if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Érvénytelen ügyfél.' }, { status: 400 })
      }
      const { data, error } = await supabase
        .from('customers')
        .select(
          `
          id,
          name,
          email,
          mobile,
          billing_name,
          billing_country,
          billing_city,
          billing_postal_code,
          billing_street,
          billing_house_number,
          billing_tax_number
        `
        )
        .eq('tenant_id', user.tenantId)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw new Error(error.message)
      const row: OptiCustomerOption | null = data
        ? {
            ...data,
            billing_country: data.billing_country || 'Magyarország'
          }
        : null
      return NextResponse.json({ rows: row ? [row] : [] })
    }

    const rows = await searchCustomersForSelect(
      supabase,
      user.tenantId,
      q,
      limit
    )
    return NextResponse.json({ rows })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Nem sikerült a keresés.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
