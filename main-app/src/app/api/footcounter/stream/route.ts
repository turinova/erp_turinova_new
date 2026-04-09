import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { hasPagePermission } from '@/lib/permissions-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Authenticated MJPEG proxy. Set FOOTCOUNTER_MJPEG_URL on the Next server
 * (e.g. http://100.x.x.x:8000/stream.mjpg via Tailscale).
 * For long-lived streams on serverless hosts, prefer NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL on the client.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await hasPagePermission(user.id, '/footcounter-live')
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const upstreamUrl = process.env.FOOTCOUNTER_MJPEG_URL?.trim()
    if (!upstreamUrl) {
      return NextResponse.json(
        { error: 'FOOTCOUNTER_MJPEG_URL is not configured on the server' },
        { status: 503 }
      )
    }

    const controller = new AbortController()
    const connectTimeout = setTimeout(() => controller.abort(), 15000)

    let upstream: Response
    try {
      upstream = await fetch(upstreamUrl, {
        cache: 'no-store',
        signal: controller.signal
      })
    } finally {
      clearTimeout(connectTimeout)
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Upstream camera unavailable', status: upstream.status },
        { status: 502 }
      )
    }

    const contentType =
      upstream.headers.get('Content-Type') || 'multipart/x-mixed-replace; boundary=FRAME'

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, private',
        Pragma: 'no-cache'
      }
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    if (message.includes('abort')) {
      return NextResponse.json({ error: 'Connection to camera timed out' }, { status: 504 })
    }
    console.error('footcounter stream proxy:', e)
    return NextResponse.json({ error: 'Stream proxy failed' }, { status: 500 })
  }
}
