import { NextResponse, type NextRequest } from 'next/server'

import {
  isLinkPreviewAgent,
  parseGoogleReviewClickSource
} from '@/lib/company/google-profile'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const CODE_RE = /^[A-Za-z0-9]{4,16}$/

function unavailable() {
  const html = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>A link nem elérhető</title>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#fafafa;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#18181b;padding:16px}
.c{max-width:420px;width:100%;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:32px 16px;text-align:center}
h1{font-size:18px;margin:0}p{margin:8px 0 0;color:#52525b}</style></head>
<body><div class="c"><h1>A link nem elérhető</h1><p>Lehet, hogy elírták, vagy a cég már nem használja. Ha értékelni szeretnéd őket, keresd meg a cég nevét a Google Térképen.</p></div></body></html>`
  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  })
}

type Admin = NonNullable<ReturnType<typeof createServiceClient>>

/** Státusz oldali kattintás: token → megosztott link + vevő (csak ugyanazon tenanton belül). */
async function resolveShareLink(
  admin: Admin,
  tenantId: string,
  token: string | null
): Promise<{ id: string; customerId: string | null } | null> {
  const clean = token?.trim()
  if (!clean || clean.length > 64) return null
  const { data: link } = await admin
    .from('order_share_links')
    .select('id, kind, quote_id, customer_special_order_id')
    .eq('token', clean)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!link) return null

  const table = link.kind === 'quote' ? 'quotes' : 'customer_special_orders'
  const orderId = link.kind === 'quote' ? link.quote_id : link.customer_special_order_id
  if (!orderId) return { id: link.id as string, customerId: null }
  const { data: order } = await admin
    .from(table)
    .select('customer_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return { id: link.id as string, customerId: (order?.customer_id as string | null) ?? null }
}

async function resolve(request: NextRequest, code: string, logClick: boolean) {
  if (!CODE_RE.test(code)) return unavailable()

  const admin = createServiceClient()
  if (!admin) return unavailable()

  const { data, error } = await admin
    .from('tenant_companies')
    .select('tenant_id, google_review_url')
    .eq('google_review_code', code)
    .maybeSingle()

  if (error || !data?.google_review_url) return unavailable()

  const userAgent = request.headers.get('user-agent')
  const isPrefetch =
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('sec-purpose')?.includes('prefetch') === true

  if (logClick && !isPrefetch && !isLinkPreviewAgent(userAgent)) {
    const source = parseGoogleReviewClickSource(request.nextUrl.searchParams.get('s'))
    const share = await resolveShareLink(
      admin,
      data.tenant_id as string,
      request.nextUrl.searchParams.get('t')
    )
    const base = {
      tenant_id: data.tenant_id,
      user_agent: userAgent?.slice(0, 300) ?? null
    }
    const { error: logError } = await admin.from('google_review_link_clicks').insert({
      ...base,
      source,
      share_link_id: share?.id ?? null,
      customer_id: share?.customerId ?? null
    })
    if (logError) {
      // 20261004 előtt: nincs share_link_id / customer_id oszlop, és a 'status' forrás sem engedett.
      const { error: retryError } = await admin
        .from('google_review_link_clicks')
        .insert({ ...base, source: source === 'status' ? 'other' : source })
      if (retryError) console.error('google review click log', retryError.message)
    }
  }

  return NextResponse.redirect(data.google_review_url, {
    status: 302,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  })
}

type Params = Promise<{ code: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { code } = await params
  return resolve(request, code, true)
}

export async function HEAD(request: NextRequest, { params }: { params: Params }) {
  const { code } = await params
  return resolve(request, code, false)
}
