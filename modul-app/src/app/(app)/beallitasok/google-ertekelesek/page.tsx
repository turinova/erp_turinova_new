import type { Metadata } from 'next'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { ReviewLogFilters, ReviewLogTable } from '@/components/reviews/review-log-table'
import { ReviewOverview } from '@/components/reviews/review-overview'
import { ReviewPageChrome, parseReviewTab } from '@/components/reviews/review-page-chrome'
import { ReviewPager } from '@/components/reviews/review-pager'
import { ReviewQueueTable } from '@/components/reviews/review-queue-table'
import { ReviewSettingsForm } from '@/components/reviews/review-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import { googleReviewShortPath } from '@/lib/company/google-profile'
import { getTenantGoogleProfile } from '@/lib/company/queries'
import { tenantHasPartnerOrders } from '@/lib/home/partner-portal-inbox'
import { appOrigin } from '@/lib/order-status/format'
import { getGoogleRatingSummary } from '@/lib/reviews/google-rating'
import {
  getPartnerReviewStats,
  getReviewClickStats,
  getReviewThankSmsStats
} from '@/lib/reviews/queries'
import {
  REVIEW_QUEUE_PAGE_SIZE,
  getReviewFunnel,
  listReviewQueue,
  type ReviewLogPeriod,
  type ReviewLogStatusFilter
} from '@/lib/reviews/queue-queries'
import { getTenantReviewSettings } from '@/lib/reviews/settings'
import { tenantHasAnySms } from '@/lib/sms/entitlement'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Google értékelések'
}

const DESCRIPTION =
  'Hol és mikor kérjük meg a vevőt, hogy értékeljen a Google-ön. Mindenki ugyanazt a linket kapja, nem szűrünk elégedettség szerint.'

type SearchParams = Promise<{ tab?: string; page?: string; status?: string; days?: string }>

function parseLogStatus(raw: string | undefined): ReviewLogStatusFilter {
  return raw === 'sent' || raw === 'skipped' || raw === 'cancelled' || raw === 'failed' ? raw : 'all'
}

function parseDays(raw: string | undefined): ReviewLogPeriod {
  const n = Number(raw)
  return n === 7 || n === 90 ? n : 30
}

export default async function ReviewSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Google értékelések</h1>
        <p className="max-w-xl text-body text-ink-secondary">
          {user?.isDevSession ? 'Dev bypass módban nincs tenant adatbázis.' : 'Nincs aktív céged.'}
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Google értékelések</h1>
        <p className="text-body text-ink-secondary">Az adatbázis kapcsolat nem elérhető.</p>
      </div>
    )
  }

  const tenantId = user.tenantId
  const tab = parseReviewTab(params.tab)
  const page = Math.max(1, Number(params.page) || 1)

  const [review, google, clicks, thankSms, hasSms, hasPartnerPortal, partnerStats, rating] =
    await Promise.all([
      getTenantReviewSettings(supabase, tenantId),
      getTenantGoogleProfile(supabase, tenantId),
      getReviewClickStats(supabase, tenantId),
      getReviewThankSmsStats(supabase, tenantId),
      tenantHasAnySms(supabase, tenantId),
      tenantHasPartnerOrders(supabase, tenantId),
      getPartnerReviewStats(supabase, tenantId),
      getGoogleRatingSummary(supabase, tenantId)
    ])

  const shortUrl = google.code ? `${appOrigin()}${googleReviewShortPath(google.code)}` : null
  const hasLink = Boolean(google.reviewUrl && shortUrl)

  const chrome = (
    <ReviewPageChrome
      active={tab}
      shortUrl={hasLink ? shortUrl : null}
      googleAvailable={google.available}
      rating={rating}
      pendingCount={thankSms.pending}
    />
  )

  if (tab === 'csatornak') {
    return (
      <ReviewSettingsForm
        initial={review.settings}
        available={review.available}
        canWrite={canWrite}
        google={{ available: google.available, reviewUrl: google.reviewUrl, shortUrl }}
        clicks={clicks}
        thankSms={thankSms}
        hasSms={hasSms}
        hasPartnerPortal={hasPartnerPortal}
        partnerStats={partnerStats}
        chrome={chrome}
      />
    )
  }

  let body: React.ReactNode
  if (tab === 'attekintes') {
    const funnel = await getReviewFunnel(supabase, tenantId, rating.delta30d)
    body = (
      <ReviewOverview
        funnel={funnel}
        clicks={clicks}
        settings={review.settings}
        hasSms={hasSms}
        hasPartnerPortal={hasPartnerPortal}
        hasLink={hasLink}
      />
    )
  } else if (tab === 'utemezett') {
    const list = await listReviewQueue(supabase, tenantId, { mode: 'pending' }, page)
    body = (
      <div className="space-y-2">
        <p className="px-0.5 text-hint text-ink-secondary">
          Csak 9 és 19 óra között megy ki. Ha a vevő közben megnyitotta a linket, vagy nemrég már kértük, a rendszer
          magától kihagyja.
        </p>
        <ReviewQueueTable rows={list.rows} canWrite={canWrite} manageAvailable={list.manageAvailable} />
        <ReviewPager
          page={list.page}
          total={list.total}
          pageSize={REVIEW_QUEUE_PAGE_SIZE}
          hrefFor={(p) => `?tab=utemezett&page=${p}`}
        />
      </div>
    )
  } else {
    const status = parseLogStatus(params.status)
    const days = parseDays(params.days)
    const list = await listReviewQueue(supabase, tenantId, { mode: 'log', status, days }, page)
    const href = (p: { status?: ReviewLogStatusFilter; days?: ReviewLogPeriod; page?: number }) => {
      const q = new URLSearchParams({ tab: 'naplo' })
      const s = p.status ?? status
      const d = p.days ?? days
      if (s !== 'all') q.set('status', s)
      if (d !== 30) q.set('days', String(d))
      if (p.page && p.page > 1) q.set('page', String(p.page))
      return `?${q.toString()}`
    }
    body = (
      <div className="space-y-2">
        <ReviewLogFilters status={status} days={days} hrefFor={href} />
        <ReviewLogTable rows={list.rows} />
        <ReviewPager
          page={list.page}
          total={list.total}
          pageSize={REVIEW_QUEUE_PAGE_SIZE}
          hrefFor={(pg) => href({ page: pg })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Google értékelések" description={DESCRIPTION} />
      {chrome}
      {body}
    </div>
  )
}
