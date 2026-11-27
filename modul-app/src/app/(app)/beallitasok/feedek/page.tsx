import type { Metadata } from 'next'

import { OpenAiFeedForm } from '@/components/feeds/openai-feed-form'
import { OpenAiFeedPreview, type PreviewFilter } from '@/components/feeds/openai-feed-preview'
import { getSessionUser } from '@/lib/auth/session'
import { buildFeed, buildItem, groupKey, SKIP_REASON_LABEL } from '@/lib/feeds/openai/build'
import { feedConfig, getOpenAiFeedSettings, loadFeedRows, type OpenAiFeedSettings } from '@/lib/feeds/openai/load'
import { appOrigin } from '@/lib/order-status/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Termékfeedek'
}

const PAGE_SIZE = 25

type SearchParams = Promise<{ page?: string; szuro?: string }>

function parseFilter(raw: string | undefined): PreviewFilter {
  return raw === 'bekerul' || raw === 'kimarad' ? raw : 'mind'
}

function websiteToHttps(raw: string | null | undefined): string {
  const t = (raw ?? '').trim().replace(/\/+$/, '')
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t.replace(/^http:/i, 'https:') : `https://${t}`
}

export default async function FeedsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Termékfeedek</h1>
        <p className="text-body text-ink-secondary">
          {user?.isDevSession ? 'Dev bypass módban nincs tenant adatbázis.' : 'Nincs aktív céged.'}
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Termékfeedek</h1>
        <p className="text-body text-ink-secondary">Az adatbázis kapcsolat nem elérhető.</p>
      </div>
    )
  }

  const tenantId = user.tenantId
  const [{ available, settings }, { data: company }] = await Promise.all([
    getOpenAiFeedSettings(supabase, tenantId),
    supabase
      .from('tenant_companies')
      .select('name, website, postal_code, city, address')
      .eq('tenant_id', tenantId)
      .maybeSingle()
  ])

  const sellerName = company?.name?.trim() ?? ''
  const address = [company?.postal_code, company?.city, company?.address].filter(Boolean).join(' ')
  const effective: OpenAiFeedSettings = settings ?? {
    enabled: false,
    token: '',
    siteBaseUrl: websiteToHttps(company?.website),
    sheetPath: '/butorlap',
    linearPath: '/munkalap',
    country: 'HU',
    currency: 'HUF',
    pickupText: address ? `${address}.` : '',
    returnPolicyUrl: '',
    returnDays: 14,
    lastFetchedAt: null,
    lastItemCount: null
  }

  const feedUrl = settings?.token ? `${appOrigin()}/api/feeds/openai/${settings.token}/feed.jsonl` : null

  let preview: React.ReactNode = null
  if (available) {
    let rows: Awaited<ReturnType<typeof loadFeedRows>> = []
    let loadError: string | null = null
    try {
      rows = await loadFeedRows(supabase, tenantId)
    } catch (e) {
      loadError = e instanceof Error ? e.message : 'Nem sikerült betölteni a termékeket.'
    }

    const cfg = feedConfig(effective, sellerName)
    const { items, skipped } = buildFeed(rows, cfg)
    const skipById = new Map(skipped.map((s) => [s.row.id, s.reason]))
    const groupSizes = new Map<string, number>()
    for (const it of items) groupSizes.set(it.group_id, (groupSizes.get(it.group_id) ?? 0) + 1)

    const filter = parseFilter(params.szuro)
    const filtered = rows.filter((r) =>
      filter === 'mind' ? true : filter === 'bekerul' ? !skipById.has(r.id) : skipById.has(r.id)
    )
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const page = Math.min(pageCount, Math.max(1, Number(params.page) || 1))
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const reasonCounts = new Map<string, number>()
    for (const s of skipped) {
      const label = SKIP_REASON_LABEL[s.reason]
      reasonCounts.set(label, (reasonCounts.get(label) ?? 0) + 1)
    }

    preview = (
      <OpenAiFeedPreview
        loadError={loadError}
        included={items.length}
        skippedCount={skipped.length}
        reasonCounts={[...reasonCounts.entries()].sort((a, b) => b[1] - a[1])}
        filter={filter}
        page={page}
        pageCount={pageCount}
        canWrite={canWrite}
        rows={pageRows.map((r) => {
          const reason = skipById.get(r.id)
          const item = reason ? null : buildItem(r, cfg, groupSizes.get(groupKey(r)) ?? 1)
          return {
            id: r.id,
            kind: r.kind,
            name: r.name,
            brand: r.brand,
            excluded: r.excluded,
            reason: reason ? SKIP_REASON_LABEL[reason] : null,
            item
          }
        })}
      />
    )
  }

  return (
    <div className="space-y-4">
      <OpenAiFeedForm
        available={available}
        canWrite={canWrite}
        initial={effective}
        feedUrl={feedUrl}
        sellerName={sellerName}
      />
      {preview}
    </div>
  )
}
