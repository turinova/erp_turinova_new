import { gzipSync } from 'node:zlib'

import { NextResponse } from 'next/server'

import { buildFeed, toJsonl } from '@/lib/feeds/openai/build'
import { feedConfig, getOpenAiFeedByToken, loadFeedRows } from '@/lib/feeds/openai/load'
import { createServiceClient } from '@/lib/supabase/service'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

/** OpenAI Commerce: gzipelt JSONL (.jsonl.gz), egy termék / sor. */
export async function serveOpenAiFeedJsonlGz(token: string): Promise<NextResponse> {
  if (!TOKEN_RE.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const service = createServiceClient()
  if (!service) return new NextResponse('Service unavailable', { status: 503 })

  const feed = await getOpenAiFeedByToken(service, token)
  if (!feed) return new NextResponse('Not found', { status: 404 })

  let gz: Buffer
  let count: number
  try {
    const rows = await loadFeedRows(service, feed.tenantId)
    const { items } = buildFeed(rows, feedConfig(feed.settings, feed.sellerName))
    const jsonl = toJsonl(items)
    gz = gzipSync(Buffer.from(jsonl, 'utf8'), { level: 6 })
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

  return new NextResponse(new Uint8Array(gz), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': 'inline; filename="feed.jsonl.gz"',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      'X-Robots-Tag': 'noindex'
    }
  })
}
