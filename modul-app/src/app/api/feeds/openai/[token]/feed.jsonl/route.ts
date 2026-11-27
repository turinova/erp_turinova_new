import { NextResponse } from 'next/server'

import { buildFeed, toJsonl } from '@/lib/feeds/openai/build'
import { feedConfig, getOpenAiFeedByToken, loadFeedRows } from '@/lib/feeds/openai/load'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const service = createServiceClient()
  if (!service) return new NextResponse('Service unavailable', { status: 503 })

  const feed = await getOpenAiFeedByToken(service, token)
  if (!feed) return new NextResponse('Not found', { status: 404 })

  let body: string
  let count: number
  try {
    const rows = await loadFeedRows(service, feed.tenantId)
    const { items } = buildFeed(rows, feedConfig(feed.settings, feed.sellerName))
    body = toJsonl(items)
    count = items.length
  } catch (e) {
    console.error('openai feed', e instanceof Error ? e.message : e)
    return new NextResponse('Feed error', { status: 500 })
  }

  await service
    .from('product_feeds')
    .update({ last_fetched_at: new Date().toISOString(), last_item_count: count })
    .eq('tenant_id', feed.tenantId)
    .eq('kind', 'openai')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      'X-Robots-Tag': 'noindex'
    }
  })
}
