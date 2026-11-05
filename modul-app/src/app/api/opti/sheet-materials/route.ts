import { NextResponse } from 'next/server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { getSessionUser } from '@/lib/auth/session'
import { searchSheetMaterialsForOpti } from '@/lib/search/select-search'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Staff vagy partner (partner: csak a kapcsolt cég anyagai).
  const user = await getSessionUser()
  let tenantId = user?.tenantId ?? null
  if (!tenantId) {
    const partner = await getPartnerSession()
    tenantId = partner?.selectedTenantId ?? null
  }
  if (!tenantId) {
    return NextResponse.json({ error: 'Nincs belépés.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(80, Math.max(1, Number(searchParams.get('limit')) || 40))

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  try {
    const rows = await searchSheetMaterialsForOpti(
      supabase,
      tenantId,
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
