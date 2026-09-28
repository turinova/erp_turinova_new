import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { after } from 'next/server'

import { LegalDocView } from '@/components/storefront/legal-doc-view'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { WithdrawalForm } from '@/components/storefront/withdrawal-form'
import { formatLegalDate, getStorefrontLegal } from '@/lib/storefront/legal'
import { siteUrl } from '@/lib/storefront/url'
import { legalPath, LEGAL_DOCS } from '@/lib/webshop/legal/constants'
import { hashDoc, renderLegalDoc } from '@/lib/webshop/legal/render'
import { isLegalDocKind } from '@/lib/webshop/legal/types'
import { ensureLegalVersion, latestLegalVersion, listLegalVersions } from '@/lib/webshop/legal/versions'

export const revalidate = 300

type PageProps = { params: Promise<{ site: string; doc: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { site, doc } = await params
  if (!isLegalDocKind(doc)) return {}
  const data = await getStorefrontLegal(site)
  if (!data) return {}
  return {
    title: { absolute: `${LEGAL_DOCS[doc].title} · ${data.shell.seller.name}` },
    alternates: { canonical: siteUrl(data.shell.tenant.base, legalPath(doc)) },
    robots: { index: true, follow: true }
  }
}

export default async function StorefrontLegalPage({ params }: PageProps) {
  const { site, doc: kind } = await params
  if (!isLegalDocKind(kind)) notFound()
  const data = await getStorefrontLegal(site)
  if (!data) notFound()
  const { shell, ctx } = data

  const doc = renderLegalDoc(kind, ctx)
  const [latest, history] = await Promise.all([
    latestLegalVersion(shell.admin, shell.tenant.id, kind),
    listLegalVersions(shell.admin, shell.tenant.id, kind, 10)
  ])
  const current = latest?.hash === hashDoc(doc) ? latest : null
  if (!current) {
    after(async () => {
      await ensureLegalVersion(shell.admin, shell.tenant.id, doc)
    })
  }
  const older = history.filter((v) => v.version !== current?.version)

  const meta = (
    <div className="space-y-1">
      <p>
        Hatályos: {formatLegalDate(current?.createdAt ?? new Date().toISOString())}
        {current ? ` · ${current.version}. változat` : null}
      </p>
      {older.length > 0 ? (
        <p>
          Korábbi változatok:{' '}
          {older.map((v, i) => (
            <span key={v.version}>
              {i > 0 ? ', ' : null}
              <a href={`${legalPath(kind)}/v/${v.version}`} className="cursor-pointer underline underline-offset-2">
                {v.version}. ({formatLegalDate(v.createdAt)})
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )

  return (
    <StorefrontFrame seller={shell.seller} settings={shell.settings} categories={shell.categories}>
      <main>
        <LegalDocView
          doc={doc}
          meta={meta}
          form={
            kind === 'elallas' ? (
              <WithdrawalForm privacyUrl={shell.settings.privacyUrl} returnDays={ctx.returns.days} />
            ) : undefined
          }
        />
      </main>
    </StorefrontFrame>
  )
}
