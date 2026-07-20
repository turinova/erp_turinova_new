import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  isValidHomeNewsPin,
  normalizeHomeNewsFields,
  pinErrorResponse,
  requireHomeNewsUser,
  unauthorizedResponse
} from '@/lib/home-news-api'
import { getHomeNewsPosts } from '@/lib/home-news-server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  try {
    const user = await requireHomeNewsUser()
    if (!user) return unauthorizedResponse()

    const posts = await getHomeNewsPosts()
    return NextResponse.json(posts)
  } catch (error) {
    console.error('GET /api/home-news:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireHomeNewsUser()
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    if (!isValidHomeNewsPin(body.pin)) return pinErrorResponse()

    const { title, body: textBody, kind, link_url, link_label, errors } = normalizeHomeNewsFields(body)
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('home_news_posts')
      .insert({
        title,
        body: textBody,
        kind,
        link_url,
        link_label,
        created_by: user.id,
        is_active: true
      })
      .select('id, title, body, kind, link_url, link_label, is_active, created_by, created_at, updated_at')
      .single()

    if (error) {
      console.error('POST /api/home-news insert:', error)
      return NextResponse.json({ error: 'Nem sikerült menteni' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/home-news:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
