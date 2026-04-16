import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

type ClientLogLevel = 'debug' | 'info' | 'warn' | 'error'

function safeStringify(value: unknown, maxLen = 8000): string {
  try {
    const s = JSON.stringify(value)
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
  } catch {
    return '"<unserializable>"'
  }
}

/**
 * POST /api/client-logs
 * Lightweight bridge for browser-only errors to show up in Vercel server logs.
 *
 * This is intentionally minimal: it logs a single line with structured JSON context.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as
      | {
          level?: ClientLogLevel
          message?: string
          context?: unknown
        }
      | null

    const level: ClientLogLevel = (body?.level || 'error') as ClientLogLevel
    const message = typeof body?.message === 'string' ? body.message : 'Client log'
    const context = body?.context ?? null

    const payload = {
      at: new Date().toISOString(),
      level,
      message,
      user: { id: user.id, email: user.email ?? null },
      request: {
        ua: request.headers.get('user-agent') ?? null,
        referer: request.headers.get('referer') ?? null,
        url: request.url,
      },
      context,
    }

    const line = `[CLIENT_LOG] ${safeStringify(payload)}`
    if (level === 'debug') console.debug(line)
    else if (level === 'info') console.info(line)
    else if (level === 'warn') console.warn(line)
    else console.error(line)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.warn('[CLIENT_LOG] handler error:', e)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

