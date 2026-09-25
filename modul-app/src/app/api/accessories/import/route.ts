import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { applyAccessoryImport } from '@/lib/accessories/import-apply'
import { planUpload, serverError } from '@/lib/accessories/import-route'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const planned = await planUpload(request)
    if (!planned.ok) return planned.response
    const { supabase, tenantId, plan } = planned.value
    if (plan.writes.length === 0) {
      return NextResponse.json(
        { error: plan.preview.stats.error > 0 ? 'Nincs menthető sor. Javítsd a hibás sorokat.' : 'Nincs mit menteni.' },
        { status: 400 }
      )
    }
    const result = await applyAccessoryImport(supabase, tenantId, plan)
    revalidatePath('/torzsadatok/alapanyagok/termekek')
    return NextResponse.json(result)
  } catch (err) {
    return serverError(
      'accessories import',
      err,
      'A mentés megszakadt. Töltsd fel újra ugyanezt a fájlt — a már mentett sorok nem duplázódnak.'
    )
  }
}
