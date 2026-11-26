import { NextResponse, type NextRequest } from 'next/server'

import { refreshGoogleRatings } from '@/lib/reviews/google-rating'
import { processReviewThankSmsQueue } from '@/lib/reviews/process-queue'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Köszönő SMS (Google értékelés kérés) — óránként, 9–19 óra között küld. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ error: 'no db' }, { status: 503 })

  const [result, rating] = await Promise.all([
    processReviewThankSmsQueue(admin),
    refreshGoogleRatings(admin)
  ])
  return NextResponse.json({ ...result, ratingsRefreshed: rating.refreshed })
}
