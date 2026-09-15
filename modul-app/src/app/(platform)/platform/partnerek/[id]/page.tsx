import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PartnerDetailClient } from '@/components/platform/partner-detail-client'
import { listPartnerAcceptingCompanies } from '@/lib/partner/companies'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { getPlatformPartnerDetail } from '@/lib/platform/partner-queries'
import { platformPartnerTabTitle } from '@/lib/seo/tab-titles'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { title: 'Partner' }
  const label = await platformPartnerTabTitle(ctx.admin, id)
  return { title: label ?? 'Partner' }
}

export default async function PlatformPartnerDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const [detail, companies] = await Promise.all([
    getPlatformPartnerDetail(ctx.admin, id),
    listPartnerAcceptingCompanies()
  ])
  if (!detail) notFound()

  return <PartnerDetailClient detail={detail} companies={companies} />
}
