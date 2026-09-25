import { NextRequest, NextResponse } from 'next/server'

import { planUpload, serverError } from '@/lib/accessories/import-route'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const planned = await planUpload(request)
    if (!planned.ok) return planned.response
    return NextResponse.json(planned.value.plan.preview)
  } catch (err) {
    return serverError('accessories import preview', err, 'Az előnézet nem sikerült. Próbáld újra.')
  }
}
