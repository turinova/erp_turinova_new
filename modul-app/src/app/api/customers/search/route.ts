import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { searchCustomersForSelect } from '@/lib/search/select-search'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Nincs belépés.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
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
