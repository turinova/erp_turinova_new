import { NextResponse } from 'next/server'

import { listShopImportRuns } from '@/lib/webshop/excel/apply'
import { guardRead, serverError } from '@/lib/webshop/excel/route-helpers'

export async function GET() {
  try {
    const guard = await guardRead()
    if (!guard.ok) return guard.response
    return NextResponse.json({ runs: await listShopImportRuns(guard.supabase, guard.tenantId) })
  } catch (err) {
    return serverError('webshop catalog import runs', err, 'A korábbi mentések nem tölthetők be.')
  }
}
