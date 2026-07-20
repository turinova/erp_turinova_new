import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  isValidHomeNewsPin,
  normalizeHomeNewsFields,
  pinErrorResponse,
  requireHomeNewsUser,
  unauthorizedResponse
} from '@/lib/home-news-api'
import { supabaseServer } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireHomeNewsUser()
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const body = await request.json()
    if (!isValidHomeNewsPin(body.pin)) return pinErrorResponse()

    const { title, body: textBody, kind, link_url, link_label, errors } = normalizeHomeNewsFields(body)
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('home_news_posts')
      .update({
        title,
        body: textBody,
        kind,
        link_url,
        link_label,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('is_active', true)
      .select('id, title, body, kind, link_url, link_label, is_active, created_by, created_at, updated_at')
      .single()

    if (error) {
      console.error('PATCH /api/home-news/[id]:', error)
      return NextResponse.json({ error: 'Nem sikerült frissíteni' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/home-news/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireHomeNewsUser()
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const body = await request.json()
    if (!isValidHomeNewsPin(body.pin)) return pinErrorResponse()

    const { error } = await supabaseServer
      .from('home_news_posts')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/home-news/[id]:', error)
      return NextResponse.json({ error: 'Nem sikerült törölni' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/home-news/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
