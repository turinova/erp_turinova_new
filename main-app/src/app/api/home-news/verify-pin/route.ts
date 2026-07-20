import { NextRequest, NextResponse } from 'next/server'

import { isValidHomeNewsPin, requireHomeNewsUser, unauthorizedResponse } from '@/lib/home-news-api'

export async function POST(request: NextRequest) {
  try {
    const user = await requireHomeNewsUser()
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    if (!isValidHomeNewsPin(body.pin)) {
      return NextResponse.json({ error: 'Hibás kód' }, { status: 403 })
    }

    const unlockedUntil = Date.now() + 30 * 60 * 1000
    return NextResponse.json({ ok: true, unlockedUntil })
  } catch (error) {
    console.error('POST /api/home-news/verify-pin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
