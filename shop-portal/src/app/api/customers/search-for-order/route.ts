import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/search-for-order?q=...
 * Search both persons and companies for order customer picker.
 * Returns { persons: [...], companies: [...] } with id, label, type, email.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    const personsPromise =
      q.length < 2
        ? Promise.resolve([])
        : supabase
            .from('customer_persons')
            .select('id, firstname, lastname, email, telephone')
            .is('deleted_at', null)
            .or(`firstname.ilike.%${q}%,lastname.ilike.%${q}%,email.ilike.%${q}%`)
            .order('lastname', { ascending: true })
            .order('firstname', { ascending: true })
            .limit(limit)
            .then(({ data }) =>
              (data || []).map((p: any) => ({
                id: p.id,
                type: 'person' as const,
                label: `${p.lastname} ${p.firstname}`.trim() || p.email || p.id,
                email: p.email,
                telephone: p.telephone
              }))
            )

    const companiesPromise =
      q.length < 2
        ? Promise.resolve([])
        : supabase
            .from('customer_companies')
            .select('id, name, email, telephone')
            .is('deleted_at', null)
            .or(`name.ilike.%${q}%,email.ilike.%${q}%,tax_number.ilike.%${q}%`)
            .order('name', { ascending: true })
            .limit(limit)
            .then(({ data }) =>
              (data || []).map((c: any) => ({
                id: c.id,
                type: 'company' as const,
                label: c.name || c.email || c.id,
                email: c.email,
                telephone: c.telephone
              }))
            )

    const [persons, companies] = await Promise.all([personsPromise, companiesPromise])

    return NextResponse.json({ persons, companies })
  } catch (error) {
    console.error('Error in search-for-order API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
